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
      className={`fixed inset-y-0 left-0 z-50 w-64 bg-white/80 backdrop-blur-xl border-r border-gray-200 p-4 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex justify-between items-center mb-8">
        <Link href="/" className="text-xl font-bold text-gray-800 flex items-center">
          <span className="text-2xl font-extrabold text-blue-600 mr-1">M</span>
          <span className="text-gray-900">anus Legal AI</span>
        </Link>
        <button onClick={onClose} className="lg:hidden text-gray-500 hover:text-gray-700">
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
                ? "bg-blue-500 text-white shadow-lg shadow-blue-200"
                : "text-gray-700 hover:bg-gray-100"
            }`}
            onClick={onClose}
          >
            <item.icon size={20} className="mr-3" />
            <span className="font-medium">{item.name}</span>
          </Link>
        ))}
      </nav>

      <div className="absolute bottom-4 left-4 right-4 border-t border-gray-200 pt-4">
        {session ? (
          <div className="space-y-2">
            <div className="flex items-center p-3 rounded-xl bg-gray-50">
              <User size={20} className="mr-3 text-gray-600" />
              <span className="text-sm font-medium text-gray-800 truncate">
                {session.user?.email}
              </span>
            </div>
            <button
              onClick={() => signOut()}
              className="w-full flex items-center p-3 rounded-xl text-red-600 hover:bg-red-50 transition-colors duration-150"
            >
              <LogOut size={20} className="mr-3" />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="w-full flex items-center justify-center p-3 rounded-xl bg-blue-500 text-white hover:bg-blue-600 transition-colors duration-150 shadow-md"
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
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-lg font-medium text-gray-600">Loading Session...</div>
      </div>
    );
  }

  // Redirect unauthenticated users to login, except for the home page
  if (status === "unauthenticated" && pathname !== "/") {
    // Note: NextAuth handles the actual redirect, but we can show a message
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-lg font-medium text-gray-600">Redirecting to login...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
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
        <header className="sticky top-0 z-30 lg:hidden bg-white/90 backdrop-blur-md border-b border-gray-200 p-4 flex items-center justify-between">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="text-gray-600 hover:text-gray-800"
          >
            <Menu size={24} />
          </button>
          <Link href="/" className="text-xl font-bold text-gray-800 flex items-center">
            <span className="text-2xl font-extrabold text-blue-600 mr-1">M</span>
            <span className="text-gray-900">anus Legal AI</span>
          </Link>
          {session ? (
            <button onClick={() => signOut()} className="text-red-600 hover:text-red-700">
              <LogOut size={20} />
            </button>
          ) : (
            <Link href="/login" className="text-blue-600 hover:text-blue-700">
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

