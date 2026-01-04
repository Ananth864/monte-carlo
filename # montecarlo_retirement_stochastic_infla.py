# montecarlo_retirement_stochastic_inflation.py
import numpy as np
import matplotlib.pyplot as plt

# -------------------------
# User parameters
# -------------------------
start_corpus = 16e7        # 16 crore in rupees
annual_spend = 6.5e6       # 65 lakh in rupees (base year nominal)
inflation = 0.075          # long run mean inflation (7.5%)
infl_sd = 0.02             # annual inflation standard deviation (2%)
mean_return = 0.11         # mean nominal return (11%)
volatility = 0.18          # return volatility (18%)
years = 40
sims = 100000              # number of Monte Carlo simulations
seed = 12345               # RNG seed for reproducibility

# Choose inflation model: 'normal' or 'lognormal'
# 'normal' allows negative inflation (deflation) but clips extreme values
# 'lognormal' samples multiplicative factors > 0 (no negative inflation)
inflation_model = 'normal'  # options: 'normal', 'lognormal'

# Correlation between nominal returns and inflation (set to 0 for independence)
corr = 0.2

# -------------------------
# Setup RNG and storage
# -------------------------
rng = np.random.default_rng(seed)
paths = np.empty((sims, years + 1), dtype=float)
paths[:] = np.nan

# Precompute covariance matrix for bivariate sampling (returns, inflation)
ret_sd = volatility
infl_sd_eff = infl_sd

cov = corr * ret_sd * infl_sd_eff
cov_matrix = np.array([[ret_sd**2, cov],
                       [cov, infl_sd_eff**2]])

# For lognormal inflation we will sample multiplicative factors; compute log-space params
if inflation_model == 'lognormal':
    # We want E[multiplier] = 1 + inflation approximately.
    # For lognormal: multiplier ~ lognormal(mu, sigma)
    # Choose sigma = infl_sd (approx) and solve for mu:
    sigma_ln = infl_sd_eff
    mu_ln = np.log(1 + inflation) - 0.5 * sigma_ln**2
    # We'll sample multipliers with rng.lognormal(mu_ln, sigma_ln)
else:
    mu_bivar = np.array([mean_return, inflation])  # means for bivariate normal draws

# -------------------------
# Monte Carlo loop
# -------------------------
for sim in range(sims):
    corpus = start_corpus
    paths[sim, 0] = corpus

    if inflation_model == 'lognormal':
        # Sample returns and inflation multipliers jointly by sampling returns from normal
        # and inflation multipliers independently from lognormal, then optionally correlate via rank correlation is complex.
        # Simpler approach: sample returns from normal and inflation multipliers independently from lognormal.
        # If you want correlation with lognormal inflation, use a copula approach; here we keep them independent.
        ret_series = rng.normal(loc=mean_return, scale=ret_sd, size=years)
        infl_mults = rng.lognormal(mean=mu_ln, sigma=sigma_ln, size=years)
        # cumulative multipliers for withdrawals
        infl_factors_sim = np.cumprod(infl_mults)
    else:
        # Sample bivariate normal draws for (return, inflation rate) for each year
        draws = rng.multivariate_normal(mean=mu_bivar, cov=cov_matrix, size=years)
        ret_series = draws[:, 0]
        infl_series = draws[:, 1]
        # Clip extreme deflation to avoid negative multipliers below -99%
        infl_series = np.clip(infl_series, -0.99, None)
        infl_factors_sim = np.cumprod(1.0 + infl_series)

    for yr in range(1, years + 1):
        r = ret_series[yr - 1]
        # apply nominal return for the year
        corpus = corpus * (1 + r)
        # inflation-adjusted withdrawal at year-end
        withdraw = annual_spend * infl_factors_sim[yr - 1]
        corpus = corpus - withdraw
        if corpus < 0:
            corpus = 0.0
        paths[sim, yr] = corpus

# -------------------------
# Compute percentiles and success metrics
# -------------------------
pct10 = np.percentile(paths, 10, axis=0)
pct50 = np.percentile(paths, 50, axis=0)
pct90 = np.percentile(paths, 90, axis=0)

# final-horizon success: corpus > 0 at final year
final_success_pct = np.mean(paths[:, -1] > 0) * 100.0

# survival: never hit zero after start (all years > 0)
survival_pct = np.mean(np.all(paths[:, 1:] > 0, axis=1)) * 100.0

# distribution of ruin years (first year index where corpus == 0), NaN if never ruined
ruin_mask = (paths[:, 1:] == 0)
first_ruin_idx = np.argmax(ruin_mask, axis=1)  # returns 0 if no True anywhere
never_ruined = ~np.any(ruin_mask, axis=1)
# convert indices to years, set NaN for never ruined
ruin_years = np.where(never_ruined, np.nan, first_ruin_idx + 1)  # +1 because year index starts at 1

print(f"Simulations: {sims}, Years: {years}")
print(f"Inflation model: {inflation_model}, mean inflation: {inflation:.3f}, infl SD: {infl_sd:.3f}")
print(f"Return mean: {mean_return:.3f}, return SD: {volatility:.3f}, corr: {corr:.3f}")
print(f"Final-horizon success (corpus > 0 at year {years}): {final_success_pct:.2f}%")
print(f"Survival (never hit zero during horizon): {survival_pct:.2f}%")
print(f"Median final corpus (₹): {np.median(paths[:, -1]):.0f}")

# Optional: show ruin year percentiles (for those who did ruin)
ruin_years_nonan = ruin_years[~np.isnan(ruin_years)]
if ruin_years_nonan.size > 0:
    print(f"Ruin year percentiles among ruined sims (10/50/90): "
          f"{np.percentile(ruin_years_nonan, [10,50,90]).astype(int)}")
else:
    print("No simulations ruined the portfolio in this run.")

# -------------------------
# Plot results
# -------------------------
y_ceiling = 200 * 1e7  # 200 Cr in rupees
years_axis = np.arange(0, years + 1)
plt.figure(figsize=(10, 6))

# plot a subset of sample paths for context
for i in range(min(200, sims)):
    plt.plot(years_axis, paths[i], color='lightblue', linewidth=0.5, alpha=0.5)

# shaded percentile band and median
plt.fill_between(years_axis, pct10, pct90, color='deepskyblue', alpha=0.25, label='10th–90th Percentile')
plt.plot(years_axis, pct50, color='navy', linewidth=2.0, label='Median')

plt.title('Retirement Corpus Depletion (16cr Corpus ; 65L Withdrawl ; 40 Years)')
plt.xlabel('Year of Retirement')
plt.ylabel('Corpus (₹)')
plt.xlim(0, years)
plt.ylim(0, y_ceiling)

ax = plt.gca()
yticks = np.linspace(0, y_ceiling, 6)
ax.set_yticks(yticks)
ax.set_yticklabels([f"{y/1e7:.0f} Cr" for y in yticks])

plt.grid(alpha=0.2)
plt.legend()
plt.tight_layout()
plt.show()