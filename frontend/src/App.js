import { BrowserRouter, Routes, Route } from "react-router-dom";
import PhoneTestPage from "@/pages/PhoneTestPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/phone/test" element={<PhoneTestPage />} />
        <Route path="*" element={<PhoneTestPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
