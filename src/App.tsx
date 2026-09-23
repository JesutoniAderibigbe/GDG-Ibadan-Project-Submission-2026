/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import SubmissionForm from './pages/SubmissionForm';
import JudgesDashboard from './pages/JudgesDashboard';
import Leaderboard from './pages/Leaderboard';
import ExportData from './pages/ExportData';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SubmissionForm />} />
        <Route path="/judges" element={<JudgesDashboard />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/export" element={<ExportData />} />
      </Routes>
    </BrowserRouter>
  );
}
