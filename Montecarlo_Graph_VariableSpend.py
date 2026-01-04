import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter

# ----------------------------
# Unit helpers (human-friendly)
# ----------------------------
def cr_to_rupees(x_cr: float) -> float:
    return x_cr * 1e7  # 1 Cr = 10,000,000 rupees

def lakh_to_rupees(x_lakh: float) -> float:
    return x_lakh * 1e5  # 1 Lakh = 100,000 rupees

# ---------------------------------------
# Monte Carlo engine (expects RUPEE units)
# ---------------------------------------
def run_montecarlo_time_series(
    start_corpus_rupees=160000000.0,  # RUPEES
    w0_rupees=6500000.0,              # RUPEES
    infl=0.075,
    years=40,
    mean_r=0.11,
    std_r=0.18,
    taper=0.05,
    sims=100000,
    disc_spend_rupees=2000000.0,      # RUPEES
    cut_pct=0.5,
    safe_bucket_years=5,
    taper_start_yr=20,
    use_first_n_years_reserve=True,
    bad_year_is_return_below_inflation=False,
    reserve_r=0.055,                  # annual yield for safe bucket (e.g., 5.5%)
    random_seed=None
):
    """
    Tracks total corpus (risky + safe) year by year in RUPEES.
    Safe bucket compounds annually at reserve_r BEFORE withdrawals.
    """

    # Normalize percent-style inputs
    if cut_pct > 1.0:
        cut_pct = cut_pct / 100.0
    cut_pct = max(0.0, cut_pct)

    if reserve_r is None:
        reserve_r = 0.0
    if reserve_r > 1.0:  # allow 5.5 meaning 5.5%
        reserve_r = reserve_r / 100.0

    if random_seed is not None:
        np.random.seed(random_seed)

    # Buckets
    safe_bucket = safe_bucket_years * w0_rupees
    risky_start = start_corpus_rupees - safe_bucket
    if risky_start < 0:
        raise ValueError("Safe bucket exceeds starting corpus.")

    total_by_year = np.zeros((years + 1, sims), dtype=float)

    for sim in range(sims):
        risky_corpus = risky_start
        safe_remain = safe_bucket
        total_by_year[0, sim] = risky_corpus + safe_remain  # equals start_corpus_rupees

        w_annual = w0_rupees
        w_disc_adj = disc_spend_rupees

        for yr in range(1, years + 1):
            # Risky growth
            r = np.random.normal(loc=mean_r, scale=std_r)
            risky_corpus *= (1.0 + r)

            # Safe bucket compounds BEFORE spending
            if safe_remain > 0.0 and reserve_r > 0.0:
                safe_remain *= (1.0 + reserve_r)

            # Spending adjustments
            if yr > 1:
                if yr <= taper_start_yr:
                    w_annual *= (1.0 + infl)
                    w_disc_adj *= (1.0 + infl)
                else:
                    w_annual *= (1.0 + infl) * (1.0 - taper)
                    w_disc_adj *= (1.0 + infl) * (1.0 - taper)

            # Bad year definition and discretionary cut
            is_bad_year = r < infl if bad_year_is_return_below_inflation else r < 0.0
            if is_bad_year:
                w_disc_adj *= (1.0 - cut_pct)

            # Total withdrawals
            w_essential = max(0.0, w_annual - w_disc_adj)
            total_w = w_essential + w_disc_adj

            # Draw order
            if use_first_n_years_reserve:
                if yr <= safe_bucket_years and safe_remain > 0.0:
                    if safe_remain >= total_w:
                        safe_remain -= total_w
                    else:
                        total_w -= safe_remain
                        safe_remain = 0.0
                        risky_corpus -= total_w
                else:
                    risky_corpus -= total_w
            else:
                if is_bad_year and safe_remain > 0.0:
                    if safe_remain >= total_w:
                        safe_remain -= total_w
                    else:
                        total_w -= safe_remain
                        safe_remain = 0.0
                        risky_corpus -= total_w
                else:
                    risky_corpus -= total_w

            risky_corpus = max(0.0, risky_corpus)
            total_by_year[yr, sim] = risky_corpus + safe_remain

            # Early termination
            if risky_corpus == 0.0 and safe_remain == 0.0:
                if yr < years:
                    total_by_year[yr + 1 :, sim] = 0.0
                break

    df = pd.DataFrame(total_by_year, index=range(years + 1))

    # Year 0 must match start
    y0_mean = df.iloc[0, :].mean()
    assert np.allclose(y0_mean, start_corpus_rupees, rtol=0, atol=1e-6), \
        f"Year 0 mismatch: df mean {y0_mean:.0f} vs start {start_corpus_rupees:.0f}"

    return df

# -------------------------
# Plot (Crores, original UI)
# -------------------------
def plot_percentiles_with_simulations(
    df,
    start_corpus_rupees,
    percentiles=(0.10, 0.50, 0.90),
    title=None,
    figsize=(12, 7),
    sim_lines=200,
    y_ceiling_cr=200,     # fixed ceiling for stability
    y_tick_step_cr=20,    # 20 Cr steps
    savefile=None
):
    years = df.index.values
    p10 = df.quantile(q=percentiles[0], axis=1)
    p50 = df.quantile(q=percentiles[1], axis=1)
    p90 = df.quantile(q=percentiles[2], axis=1)

    plt.figure(figsize=figsize)

    # Individual simulations
    for col in df.columns[:sim_lines]:
        plt.plot(years, df[col].values, color="lightblue", alpha=0.2, linewidth=0.7)

    # Percentile band
    plt.fill_between(years, p10.values, p90.values, color="skyblue", alpha=0.3, label="10th–90th percentile")

    # Median
    plt.plot(years, p50.values, color="navy", linewidth=2.8, label="Median corpus")

    # Starting dot from plotted data
    y0_value = df.iloc[0, :].mean()
    plt.scatter(0, y0_value, color="red", s=140, zorder=5, label="Starting corpus")

    plt.xlabel("Years of Retirement")
    plt.ylabel("Corpus (Cr)")  # label matches formatter
    plt.title(title or "Retirement Corpus Projection")

    # Crores formatter
    def rupees_to_cr(x, pos):
        return f"{x / 1e7:.0f} Cr"
    ax = plt.gca()
    ax.yaxis.set_major_formatter(FuncFormatter(rupees_to_cr))

    # Fixed ceiling and ticks
    ax.set_ylim(0, y_ceiling_cr * 1e7)
    ticks_cr = np.arange(0, y_ceiling_cr + 1e-9, y_tick_step_cr)
    ax.set_yticks(ticks_cr * 1e7)

    plt.grid(alpha=0.3)
    plt.legend()
    plt.tight_layout()

    if savefile:
        plt.savefig(savefile, dpi=150)
    plt.show()

# -------------
# Configuration
# -------------
if __name__ == "__main__":
    # Enter human-friendly values here
    start_corpus_cr = 15.0       # 15 Cr
    w0_lakh = 60.0               # 60 Lakh
    disc_spend_lakh = 20.0       # 20 Lakh

    # Convert once to RUPEES
    start_corpus_rupees = cr_to_rupees(start_corpus_cr)
    w0_rupees = lakh_to_rupees(w0_lakh)
    disc_spend_rupees = lakh_to_rupees(disc_spend_lakh)

    # Sanity prints (should be: 250000000, 7500000, 2000000)
    print(f"Start corpus (rupees): {start_corpus_rupees:.0f}")
    print(f"W0 (rupees): {w0_rupees:.0f}")
    print(f"Discretionary (rupees): {disc_spend_rupees:.0f}")

    df = run_montecarlo_time_series(
        start_corpus_rupees=start_corpus_rupees,
        w0_rupees=w0_rupees,
        infl=0.08,
        years=40,
        mean_r=0.12,
        std_r=0.18,
        taper=0.05,
        sims=100000,
        disc_spend_rupees=disc_spend_rupees,
        cut_pct=0.5,
        safe_bucket_years=5,
        taper_start_yr=20,
        use_first_n_years_reserve=True,
        bad_year_is_return_below_inflation=False,
        reserve_r=0.055,
        random_seed=12345
    )

    plot_percentiles_with_simulations(
        df,
        start_corpus_rupees=start_corpus_rupees,
        title="Retirement Corpus Projection (₹25 Cr Corpus, ₹75L spend, 5 years safe bucket)",
        figsize=(12, 7),
        sim_lines=200,
        y_ceiling_cr=200,
        y_tick_step_cr=20,
        savefile=None
    )