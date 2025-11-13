"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  MessageSquare,
  LogOut,
  User,
  UploadCloud,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

// --- Navigation Links ---
const navItems = [
  {
    name: "Documents",
    href: "/documents",
    icon: FileText,
    authRequired: true,
  },
  {
    name: "Chat Advisor",
    href: "/chat",
    icon: MessageSquare,
    authRequired: true,
  },
];

// --- Sidebar Component ---
const Sidebar = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { data: session } = useSession();
  const pathname = usePathname();

  const filteredNavItems = navItems.filter((item) => !item.authRequired || session);

  return (
    <div
      className={`fixed inset-y-0 left-0 z-50 w-64 bg-card/80 backdrop-blur-xl border-r border-border p-4 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex justify-between items-center mb-8">
        <Link href="/" className="text-xl font-bold text-foreground flex items-center">
          <span className="text-2xl font-extrabold text-primary mr-1">C</span>
          <span className="text-foreground">elestius</span>
        </Link>
        <button onClick={onClose} className="lg:hidden text-muted-foreground hover:text-foreground">
          <X size={24} />
        </button>
      </div>

      <nav className="space-y-2">
        {filteredNavItems.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className={`flex items-center p-3 rounded-xl transition-colors duration-150 ${
              pathname === item.href
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                : "text-muted-foreground hover:bg-secondary"
            }`}
            onClick={onClose}
          >
            <item.icon size={20} className="mr-3" />
            <span className="font-medium">{item.name}</span>
          </Link>
        ))}
      </nav>

      <div className="absolute bottom-4 left-4 right-4 border-t border-border pt-4">
        {session ? (
          <div className="space-y-2">
            <div className="flex items-center p-3 rounded-xl bg-secondary">
              <User size={20} className="mr-3 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground truncate">
                {session.user?.email}
              </span>
            </div>
            <button
              onClick={() => signOut()}
              className="w-full flex items-center p-3 rounded-xl text-red-400 hover:bg-secondary transition-colors duration-150"
            >
              <LogOut size={20} className="mr-3" />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="w-full flex items-center justify-center p-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-150 shadow-md"
            onClick={onClose}
          >
            <User size={20} className="mr-2" />
            <span className="font-medium">Sign In</span>
          </Link>
        )}
      </div>
    </div>
  );
};

// --- Main Layout Component ---
export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Hide layout for auth pages
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/register");
  if (isAuthPage) {
    return <>{children}</>;
  }

  // Show a simple loading screen while session is loading
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-lg font-medium text-muted-foreground">Loading Session...</div>
      </div>
    );
  }

  // Redirect unauthenticated users to login, except for the home page
  if (status === "unauthenticated" && pathname !== "/") {
    // Perform a hard redirect to prevent potential client-side reload loops
    if (typeof window !== "undefined") {
      window.location.replace("/login");
    }
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-lg font-medium text-muted-foreground">Redirecting to login...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar isOpen={true} onClose={() => {}} />
      </div>

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 lg:ml-64 flex flex-col">
        {/* Header/Mobile Nav */}
        <header className="sticky top-0 z-30 lg:hidden bg-card/90 backdrop-blur-md border-b border-border p-4 flex items-center justify-between">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="text-muted-foreground hover:text-foreground"
          >
            <Menu size={24} />
          </button>
          <Link href="/" className="text-xl font-bold text-foreground flex items-center">
            <span className="text-2xl font-extrabold text-primary mr-1">C</span>
            <span className="text-foreground">elestius</span>
          </Link>
          {session ? (
            <button onClick={() => signOut()} className="text-red-400 hover:text-red-300">
              <LogOut size={20} />
            </button>
          ) : (
            <Link href="/login" className="text-primary hover:text-primary/80">
              <User size={20} />
            </Link>
          )}
        </header>

        {/* Content */}
        <main className="flex-1 p-4 md:p-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}

// --- Auth Provider Wrapper ---
import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}