import {
  CalendarRange,
  FileText,
  Home,
  Import,
  Map,
  Menu,
  Settings,
  SlidersHorizontal,
  TrendingUp,
  User,
  Users,
  Users2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { CanAccess, useTranslate, useUserMenu } from "ra-core";
import { Link, matchPath, useLocation } from "react-router";
import { RefreshButton } from "@/components/admin/refresh-button";
import { ThemeModeToggle } from "@/components/admin/theme-mode-toggle";
import { UserMenu } from "@/components/admin/user-menu";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import { ImportPage } from "@/components/atomic-crm/misc/ImportPage";
import { ChangelogPage } from "@/components/atomic-crm/misc/ChangelogPage";

import { Icon } from "@/lago/ui/Icon";

import { SalgsdataSyncStatus } from "@/lago/layout/SalgsdataSyncStatus";
import { useIsLagoAdmin } from "@/lago/auth/useIsLagoAdmin";
import {
  PasserForMenuItem,
  SeSomRolleMenuItem,
} from "@/lago/portefolje/PortefoljeMenu";

import { cn } from "@/lib/utils";

/**
 * LAGO topnav (Domain-brief 3e, rev. brief 37 §7 · 16. sep 2026).
 * Tab-orden: Dagens · Hjem · Kunder · Kontakter · Salgsudvikling. Aftaler-
 * fanen er skjult i navigationen frem til felt-testen — hver ekstra fane
 * er en dør sælgeren skal lære at ignorere. Ruten `/deals` og hele
 * pipeline-koden består (kan trækkes tilbage når aftaler bliver aktuelle);
 * det er kun det synlige menupunkt der er væk.
 */
export function LagoHeader() {
  const { darkModeLogo, lightModeLogo, title } = useConfigurationContext();
  const location = useLocation();
  const translate = useTranslate();
  const { isAdmin } = useIsLagoAdmin();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const currentPath = detectCurrentPath(location.pathname);

  // Brief 16 (#2): luk drawer'en når ruten skifter, så sælger ikke ser
  // en åben menu efter tap på et link.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Brief 59 (17. sep 2026): Felt-fanen erstattet af Kort som selvstændig
  // side. Ny orden: Hjem · Kort · Kunder · Kontakter · Aktiviteter ·
  // Salgsudvikling · Indstillinger. Dagens og Søg er fjernet (Dagens
  // duplerede kundelisten sorteret på Trænger; Søg var en dårligere
  // udgave af det universelle søgefelt der kommer i ROADMAP).
  const navItems = (
    <>
      <NavTab
        to="/"
        icon={<Icon icon={Home} />}
        label={translate("lago.nav.home")}
        isActive={currentPath === "/"}
      />
      <NavTab
        to="/kort"
        icon={<Icon icon={Map} />}
        label="Kort"
        isActive={currentPath === "/kort"}
      />
      <NavTab
        to="/companies"
        icon={<Icon icon={Users2} />}
        label={translate("lago.nav.customers")}
        isActive={currentPath === "/companies"}
      />
      <NavTab
        to="/contacts"
        icon={<Icon icon={Users} />}
        label={translate("lago.nav.contacts")}
        isActive={currentPath === "/contacts"}
      />
      <NavTab
        to="/aktiviteter"
        icon={<Icon icon={CalendarRange} />}
        label="Aktiviteter"
        isActive={currentPath === "/aktiviteter"}
      />
      <NavTab
        to="/salgsudvikling"
        icon={<Icon icon={TrendingUp} />}
        label={translate("lago.nav.sales_dev")}
        isActive={currentPath === "/salgsudvikling"}
      />
      {isAdmin && (
        <NavTab
          to="/indstillinger"
          icon={<Icon icon={SlidersHorizontal} />}
          label={translate("lago.nav.settings")}
          isActive={currentPath === "/indstillinger"}
          title={translate("lago.nav.settings_hint")}
        />
      )}
    </>
  );

  return (
    <nav className="grow">
      <header className="bg-secondary">
        <div className="px-4">
          <div className="flex flex-1 items-center justify-between gap-2">
            {/* Hamburger under lg (1024 px) — dvs. både iPhone og iPad
                går i drawer-mode. På md (768) fejlede den tidligere
                tærskel: nav'en var 939 px bred i et 834 px vindue
                (iPad landscape) og skubbede siden ud. lg-tærsklen
                sikrer at kun rigtig laptop viser den vandrette nav. */}
            <Button
              variant="ghost"
              size="icon"
              className="text-secondary-foreground min-h-11 lg:hidden"
              onClick={() => setDrawerOpen(true)}
              aria-label={translate("lago.nav.menu_open")}
            >
              <Icon icon={Menu} />
            </Button>

            <Link
              to="/"
              className="text-secondary-foreground flex min-w-0 items-center gap-2 no-underline"
            >
              <img
                className="h-6 [.light_&]:hidden"
                src={darkModeLogo}
                alt={title}
              />
              <img
                className="h-6 [.dark_&]:hidden"
                src={lightModeLogo}
                alt={title}
              />
              {/* Brief 38 §2 (16. sep 2026): under sm (640 px) skjules
                  "LAGO CRM"-teksten helt — logoet står selv. På 375 px
                  var titel + hamburger + ur + tema + refresh + bruger-
                  menu så mange elementer, at titlen blev klemt til
                  "LA…". Én linje, mærket alene under sm. */}
              <h1 className="hidden truncate text-xl font-bold sm:block">
                {title}
              </h1>
            </Link>

            {/* Vandret nav kun på lg+ (1024 px) — iPad går i drawer. */}
            <nav className="hidden lg:flex">{navItems}</nav>

            <div className="flex items-center gap-1">
              {/* Synk-status følger nav'en: skjult under lg, vises i
                  drawer-bunden. Tidligere sm-tærskel gjorde at iPad
                  havde både wide nav OG status → indhold blev skubbet
                  uden for viewport. */}
              <SalgsdataSyncStatus className="hidden lg:inline-flex" />
              <ThemeModeToggle />
              <RefreshButton />
              <UserMenu>
                <ProfileMenu />
                <CanAccess resource="sales" action="list">
                  <UsersMenu />
                </CanAccess>
                <CanAccess resource="configuration" action="edit">
                  <SettingsMenu />
                </CanAccess>
                <ImportFromJsonMenuItem />
                <ChangelogMenuItem />
                {/* Brief 84 tillæg A §3 (28. sep 2026): to indgange
                    til at skifte visnings-tilstand — dine egne data i
                    en anden rolles layout, eller en kollegas data +
                    hendes layout. Gensidigt udelukkende. */}
                <SeSomRolleMenuItem />
                <PasserForMenuItem />
              </UserMenu>
            </div>
          </div>
        </div>
      </header>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="flex w-72 flex-col p-0">
          <SheetHeader className="border-b p-4">
            <SheetTitle className="flex items-center gap-2">
              <img
                className="h-5 [.light_&]:hidden"
                src={darkModeLogo}
                alt={title}
              />
              <img
                className="h-5 [.dark_&]:hidden"
                src={lightModeLogo}
                alt={title}
              />
              <span>{title}</span>
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-col py-2">
            <DrawerNavItem
              to="/"
              icon={<Icon icon={Home} />}
              label={translate("lago.nav.home")}
              isActive={currentPath === "/"}
            />
            <DrawerNavItem
              to="/kort"
              icon={<Icon icon={Map} />}
              label="Kort"
              isActive={currentPath === "/kort"}
            />
            <DrawerNavItem
              to="/companies"
              icon={<Icon icon={Users2} />}
              label={translate("lago.nav.customers")}
              isActive={currentPath === "/companies"}
            />
            <DrawerNavItem
              to="/contacts"
              icon={<Icon icon={Users} />}
              label={translate("lago.nav.contacts")}
              isActive={currentPath === "/contacts"}
            />
            <DrawerNavItem
              to="/aktiviteter"
              icon={<Icon icon={CalendarRange} />}
              label="Aktiviteter"
              isActive={currentPath === "/aktiviteter"}
            />
            <DrawerNavItem
              to="/salgsudvikling"
              icon={<Icon icon={TrendingUp} />}
              label={translate("lago.nav.sales_dev")}
              isActive={currentPath === "/salgsudvikling"}
            />
            {isAdmin && (
              <DrawerNavItem
                to="/indstillinger"
                icon={<Icon icon={SlidersHorizontal} />}
                label={translate("lago.nav.settings")}
                isActive={currentPath === "/indstillinger"}
              />
            )}
          </div>
          {/* Synk-status i drawer'ens bund så mobil har samme ene sted
              som desktop-headeren — brief 19 §5 ("ét sted, aldrig som
              forbehold på widgets"). */}
          <div className="mt-auto border-t p-4">
            <SalgsdataSyncStatus tone="on-surface" className="px-0" />
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}

interface DrawerNavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
}

function DrawerNavItem({ to, icon, label, isActive }: DrawerNavItemProps) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 px-5 py-3 text-sm transition-colors",
        isActive
          ? "bg-muted text-foreground font-bold"
          : "text-foreground/80 hover:bg-muted",
      )}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

function detectCurrentPath(pathname: string): string | false {
  if (matchPath("/kort", pathname)) return "/kort";
  if (matchPath("/contacts/*", pathname)) return "/contacts";
  if (matchPath("/companies/*", pathname)) return "/companies";
  if (matchPath("/deals/*", pathname)) return "/deals";
  if (matchPath("/aktiviteter/*", pathname)) return "/aktiviteter";
  if (matchPath("/salgsudvikling/*", pathname)) return "/salgsudvikling";
  if (matchPath("/indstillinger/*", pathname)) return "/indstillinger";
  if (matchPath("/", pathname)) return "/";
  return false;
}

interface NavTabProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  title?: string;
}

function NavTab({ to, icon, label, isActive, title }: NavTabProps) {
  return (
    <Link
      to={to}
      title={title}
      className={cn(
        "inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors sm:px-6",
        isActive
          ? "text-secondary-foreground border-secondary-foreground"
          : "text-secondary-foreground/70 hover:text-secondary-foreground/80 border-transparent",
      )}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

function UsersMenu() {
  const translate = useTranslate();
  const userMenuContext = useUserMenu();
  if (!userMenuContext) {
    throw new Error("<UsersMenu> must be used inside <UserMenu>");
  }
  return (
    <DropdownMenuItem asChild onClick={userMenuContext.onClose}>
      <Link to="/sales" className="flex items-center gap-2">
        <Icon icon={Users} />
        {translate("resources.sales.name", { smart_count: 2 })}
      </Link>
    </DropdownMenuItem>
  );
}

function ProfileMenu() {
  const translate = useTranslate();
  const userMenuContext = useUserMenu();
  if (!userMenuContext) {
    throw new Error("<ProfileMenu> must be used inside <UserMenu>");
  }
  return (
    <DropdownMenuItem asChild onClick={userMenuContext.onClose}>
      <Link to="/profile" className="flex items-center gap-2">
        <Icon icon={User} />
        {translate("crm.profile.title")}
      </Link>
    </DropdownMenuItem>
  );
}

function SettingsMenu() {
  const translate = useTranslate();
  const userMenuContext = useUserMenu();
  if (!userMenuContext) {
    throw new Error("<SettingsMenu> must be used inside <UserMenu>");
  }
  return (
    <DropdownMenuItem asChild onClick={userMenuContext.onClose}>
      <Link to="/settings" className="flex items-center gap-2">
        <Icon icon={Settings} />
        {translate("crm.settings.title")}
      </Link>
    </DropdownMenuItem>
  );
}

function ImportFromJsonMenuItem() {
  const translate = useTranslate();
  const userMenuContext = useUserMenu();
  if (!userMenuContext) {
    throw new Error("<ImportFromJsonMenuItem> must be used inside <UserMenu>");
  }
  return (
    <DropdownMenuItem asChild onClick={userMenuContext.onClose}>
      <Link to={ImportPage.path} className="flex items-center gap-2">
        <Icon icon={Import} />
        {translate("crm.header.import_data")}
      </Link>
    </DropdownMenuItem>
  );
}

function ChangelogMenuItem() {
  const translate = useTranslate();
  const userMenuContext = useUserMenu();
  if (!userMenuContext) {
    throw new Error("<ChangelogMenuItem> must be used inside <UserMenu>");
  }
  return (
    <DropdownMenuItem asChild onClick={userMenuContext.onClose}>
      <Link to={ChangelogPage.path} className="flex items-center gap-2">
        <Icon icon={FileText} />
        {translate("crm.changelog.title")}
      </Link>
    </DropdownMenuItem>
  );
}
