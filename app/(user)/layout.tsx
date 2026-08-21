import { redirect } from "next/navigation";
import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import GenreSidebar from "@/components/genre-sidebar";
import MobileGenreFilter from "@/components/mobile-genre-filter";
import UserMenu from "@/components/user-menu";
import BottomNav from "@/components/bottom-nav";
import HeaderNav from "@/components/header-nav";
import { getCurrentUser } from "@/lib/user-auth";

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center">
              <span className="text-[22px] font-black tracking-tight leading-none">
                vionix<span className="text-netflix">.</span>
              </span>
            </Link>
            <HeaderNav />
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3">
            <Button variant="ghost" size="icon" asChild className="md:hidden">
              <Link href="/search" aria-label="Search">
                <Search className="h-5 w-5" />
              </Link>
            </Button>
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>

      <div className="container flex-1 items-start md:grid md:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)] gap-6 px-4 py-6">
        <aside className="hidden md:block shrink-0 overflow-y-auto border-r">
          <div className="sticky top-20 py-6 pr-6 h-[calc(100vh-5rem)]">
            <h3 className="font-semibold mb-3 text-sm text-muted-foreground">GENRES</h3>
            <GenreSidebar />
          </div>
        </aside>

        <main className="relative w-full pb-20 md:pb-0">
          <MobileGenreFilter />
          {children}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t py-8 pb-24 md:pb-8 text-center">
        <p className="text-sm text-muted-foreground">
          Developed by{" "}
          <span className="font-semibold text-foreground border-b-2 border-netflix/60 pb-px">
            Ar Kar Moe Myint
          </span>
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1.5">
          © {new Date().getFullYear()} Vionix
        </p>
      </footer>

      <BottomNav />
    </div>
  );
}
