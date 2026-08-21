import { redirect } from "next/navigation";
import Link from "next/link";
import { Clapperboard, Search, Home, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import GenreSidebar from "@/components/genre-sidebar";
import MobileGenreFilter from "@/components/mobile-genre-filter";
import UserMenu from "@/components/user-menu";
import BottomNav from "@/components/bottom-nav";
import { getCurrentUser } from "@/lib/user-auth";

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <Clapperboard className="h-6 w-6 text-netflix" />
              <span className="text-xl font-bold">MovieApp</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              <Button variant="ghost" asChild>
                <Link href="/">
                  <Home className="h-4 w-4 mr-2" />
                  Home
                </Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/search">
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/favorites">
                  <Heart className="h-4 w-4 mr-2" />
                  Favorites
                </Link>
              </Button>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="secondary" asChild>
              <Link href="/search">
                <Search className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Search</span>
              </Link>
            </Button>
            <UserMenu />
            <ThemeToggle />
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

      <BottomNav />
    </div>
  );
}
