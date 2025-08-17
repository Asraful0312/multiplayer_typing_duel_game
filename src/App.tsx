import React from "react";
import { Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Inventory from "./pages/Inventory";
import Header from "./shared/Header";
import Store from "./pages/Store";
import Leaderboard from "./pages/Leaderboard";
import { makeUseQueryWithStatus } from "convex-helpers/react";
import { useQueries } from "convex/react";
// Do this once somewhere, name it whatever you want.
export const useQueryWithStatus = makeUseQueryWithStatus(useQueries);

const App = () => {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/store" element={<Store />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
      </Routes>
    </>
  );
};

export default App;
