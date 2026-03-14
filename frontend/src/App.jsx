import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Nav from "./components/Nav";
import Discover from "./pages/Discover";
import Upload from "./pages/Upload";
import AIMatch from "./pages/AIMatch";
import Guide from "./pages/Guide";
import Admin from "./pages/Admin";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Nav />
      <Routes>
        <Route path="/" element={<Discover />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/match" element={<AIMatch />} />
        <Route path="/guide" element={<Guide />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}
