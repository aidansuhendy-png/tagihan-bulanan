import { Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import History from "@/pages/History";
import { Toaster } from "@/components/ui/sonner";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/riwayat" element={<History />} />
      </Routes>
      <Toaster richColors />
    </>
  );
}
