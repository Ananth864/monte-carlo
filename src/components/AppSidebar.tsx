import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarRail,
} from "@/components/ui/sidebar";
import { TrendingUp, Calculator, Settings, Wallet } from "lucide-react";

// Navigation items - easily extensible for future pages
const navigationItems = [
  {
    title: "Simulations",
    items: [
      {
        title: "Retirement Corpus",
        url: "/",
        icon: TrendingUp,
        description: "Monte Carlo retirement simulation with variable spending",
      },
      {
        title: "G-K Withdrawal",
        url: "/gk-withdrawal",
        icon: Wallet,
        description: "Guyton-Klinger withdrawal strategy calculator",
      },
      // Future simulation pages can be added here:
      // {
      //   title: "SWP Analysis",
      //   url: "/swp",
      //   icon: BarChart3,
      //   description: "Systematic Withdrawal Plan simulation",
      // },
    ],
  },
  // Future groups can be added here:
  // {
  //   title: "Tools",
  //   items: [
  //     { title: "SIP Calculator", url: "/sip", icon: Calculator },
  //   ],
  // },
];


export function AppSidebar() {
  const location = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md">
            <Calculator className="h-5 w-5" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold tracking-tight">Monte Carlo</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Financial Simulations</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {navigationItems.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = location.pathname === item.url;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.title}
                      >
                        <NavLink to={item.url}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-slate-200 dark:border-slate-800">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Settings" disabled className="opacity-50">
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
