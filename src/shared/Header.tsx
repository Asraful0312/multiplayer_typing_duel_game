import { SignOutButton } from "@/SignOutButton";
import { Authenticated, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Link } from "react-router-dom";
import CurrencyIcon from "./CurrencyIcon";

const Header = () => {
  const loggedInUser = useQuery(api.auth.loggedInUser);
  return (
    <header className="sticky top-0 z-10  backdrop-blur-sm h-16 flex justify-between items-center  px-10">
      <Link to="/">
        <img
          src="/keyboard.png"
          alt="logo"
          className="size-10 shrink-0 rotate-12"
        />
      </Link>
      <Authenticated>
        <div className="flex items-center gap-4">
          <ul className="flex items-center gap-4">
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
      </Authenticated>
    </header>
  );
};

export default Header;
