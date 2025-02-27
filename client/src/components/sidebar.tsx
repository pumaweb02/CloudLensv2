import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/use-user";
import { Home, Users, LogOut, Map, CloudRain } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

export function Sidebar() {
  const { user, logout } = useUser();

  return (
    <div className="h-screen w-64 bg-card border-r border-border flex flex-col">
      <div className="p-6">
        <h1 className="text-lg font-semibold text-card-foreground">CloudLens</h1>
        <p className="text-sm text-muted-foreground mt-2">Welcome, {user?.username}</p>
      </div>

      <nav className="flex-1 px-4 space-y-2">
        <Link href="/">
          <Button variant="ghost" className="w-full justify-start">
            <Home className="mr-2 h-4 w-4" />
            Dashboard
          </Button>
        </Link>

        <Link href="/property-explorer">
          <Button variant="ghost" className="w-full justify-start">
            <Map className="mr-2 h-4 w-4" />
            Property Explorer
          </Button>
        </Link>

        <Link href="/weather">
          <Button variant="ghost" className="w-full justify-start">
            <CloudRain className="mr-2 h-4 w-4" />
            Weather Dashboard
          </Button>
        </Link>

        {user?.role === "admin" && (
          <Link href="/users">
            <Button variant="ghost" className="w-full justify-start">
              <Users className="mr-2 h-4 w-4" />
              Manage Users
            </Button>
          </Link>
        )}
      </nav>

      <div className="p-4 border-t border-border space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Theme</span>
          <ThemeToggle />
        </div>
        <Button variant="outline" className="w-full justify-start" onClick={() => logout()}>
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );
}