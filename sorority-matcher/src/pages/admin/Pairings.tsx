import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMatching } from '../../contexts/MatchingContext';
import * as XLSX from 'xlsx';

const Pairings = () => {
  const navigate = useNavigate();
  const { pairings } = useMatching();
  const [exportMessage, setExportMessage] = useState('');

  const exportResults = () => {
    let text = 'Big-Little Pairings\n';
    text += '===================\n\n';

    pairings.forEach((pairing, index) => {
      const twinLabel = pairing.littles.length > 1 ? ' (TWINS)' : '';
      text += `${index + 1}. ${pairing.big} ← ${pairing.littles.join(', ')}${twinLabel}\n`;
    });

    const totalMatched = pairings.reduce((sum, p) => sum + p.littles.length, 0);
    text += `\n\nSummary\n`;
    text += `-------\n`;
    text += `Total Bigs Matched: ${pairings.length}\n`;
    text += `Total Littles Matched: ${totalMatched}\n`;
    text += `Twin Pairings: ${pairings.filter(p => p.littles.length > 1).length}\n`;

    navigator.clipboard.writeText(text).then(() => {
      setExportMessage('Results copied to clipboard!');
      setTimeout(() => setExportMessage(''), 3000);
    }).catch(() => {
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sorora-pairings.txt';
      a.click();
      URL.revokeObjectURL(url);
      setExportMessage('Results downloaded as file!');
      setTimeout(() => setExportMessage(''), 3000);
    });
  };

  const exportToExcel = () => {
    // Create worksheet data
    const worksheetData = [
      ['Big-Little Pairings'],
      [],
      ['#', 'Big', 'Little(s)', 'Notes'],
    ];

    pairings.forEach((pairing, index) => {
      const twinLabel = pairing.littles.length > 1 ? 'TWINS' : '';
      worksheetData.push([
        String(index + 1),
        pairing.big,
        pairing.littles.join(', '),
        twinLabel
      ]);
    });

    // Add summary section
    const totalMatched = pairings.reduce((sum, p) => sum + p.littles.length, 0);
    worksheetData.push(
      [],
      ['Summary'],
      ['Total Bigs Matched:', String(pairings.length)],
      ['Total Littles Matched:', String(totalMatched)],
      ['Twin Pairings:', String(pairings.filter(p => p.littles.length > 1).length)]
    );

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);

    // Set column widths
    ws['!cols'] = [
      { wch: 5 },  // # column
      { wch: 25 }, // Big column
      { wch: 30 }, // Little(s) column
      { wch: 10 }  // Notes column
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Pairings');

    // Generate and download file
    XLSX.writeFile(wb, 'sorora-pairings.xlsx');

    setExportMessage('Excel file downloaded!');
    setTimeout(() => setExportMessage(''), 3000);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <header className="mb-12">
        <h1 className="text-4xl font-bold text-center">Sorora</h1>
      </header>

      <div className="max-w-4xl w-full bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-3xl font-semibold mb-8">Pairings</h2>

        {pairings.length === 0 ? (
          <p className="text-gray-700 text-lg">No pairings yet</p>
        ) : (
          <>
            <ul className="space-y-3 mb-8">
              {pairings.map((pairing, index) => (
                <li key={index} className="text-lg p-3 bg-gray-50 rounded-md">
                  {pairing.big} ← {pairing.littles.join(', ')}
                  {pairing.littles.length > 1 && ' (TWINS)'}
                </li>
              ))}
            </ul>

            <div className="flex flex-col items-center gap-4">
              <div className="flex gap-4">
                <button
                  onClick={exportResults}
                  className="px-6 py-3 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                >
                  Export as Text
                </button>
                <button
                  onClick={exportToExcel}
                  className="px-6 py-3 bg-black text-white rounded-md hover:bg-gray-800 transition-colors"
                >
                  Export to Excel
                </button>
              </div>
              {exportMessage && (
                <p className="text-green-600 font-semibold">{exportMessage}</p>
              )}
            </div>
          </>
        )}
      </div>

      <div className="mt-8">
        <button
          onClick={() => navigate('/admin/review-summary')}
          className="px-8 py-3 bg-gray-300 text-black rounded-md hover:bg-gray-400 transition-colors text-xl"
        >
          ⟵ Edit Inputs
        </button>
      </div>
    </div>
  );
};

export default Pairings;
