import { useState } from "react";
import { SignOutButton } from "@/SignOutButton";
import { Authenticated, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Link } from "react-router-dom";
import CurrencyIcon from "./CurrencyIcon";
import { Menu, X } from "lucide-react"; // icons for mobile toggle

const Header = () => {
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-10 backdrop-blur-sm h-16 flex justify-between items-center px-6 md:px-10">
      {/* Logo */}
      <Link to="/" className="flex items-center">
        <img
          src="/keyboard.png"
          alt="logo"
          className="size-10 shrink-0 rotate-12"
        />
      </Link>

      <Authenticated>
        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-4">
          <ul className="flex items-center gap-6">
            <li>
              <Link to="/inventory">Inventory</Link>
            </li>
            <li>
              <Link to="/store">Store</Link>
            </li>
            <li>
              <Link to="/leaderboard">Leaderboard</Link>
            </li>
          </ul>

          {loggedInUser && (
            <>
              <div className="flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-full">
                Score: {loggedInUser.score || "00"}
              </div>
              <div className="flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-full">
                <CurrencyIcon /> <p>{loggedInUser.coins || "00"}</p>
              </div>
            </>
          )}

          <SignOutButton />
        </div>

        {/* Mobile Toggle */}
        <button
          className="md:hidden p-2"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="absolute top-16 left-0 w-full bg-white shadow-md md:hidden">
            <ul className="flex flex-col gap-4 p-4">
              <li>
                <Link to="/inventory" onClick={() => setMenuOpen(false)}>
                  Inventory
                </Link>
              </li>
              <li>
                <Link to="/store" onClick={() => setMenuOpen(false)}>
                  Store
                </Link>
              </li>
              <li>
                <Link to="/leaderboard" onClick={() => setMenuOpen(false)}>
                  Leaderboard
                </Link>
              </li>
            </ul>

            <div className="flex flex-col gap-3 px-4 pb-4">
              {loggedInUser && (
                <>
                  <div className="flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-full justify-center">
                    Score: {loggedInUser.score || "00"}
                  </div>
                  <div className="flex items-center justify-center gap-2 bg-gray-100 px-3 py-1 rounded-full">
                    <CurrencyIcon /> <p>{loggedInUser.coins || "00"}</p>
                  </div>
                </>
              )}
              <SignOutButton />
            </div>
          </div>
        )}
      </Authenticated>
    </header>
  );
};

export default Header;
