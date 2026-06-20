export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center">
      <h1 className="text-6xl font-bold mb-6">
        WealthOS 💰
      </h1>

      <p className="text-xl text-slate-300 mb-8">
        Your Personal Financial Operating System
      </p>

      <div className="space-y-2 text-center">
        <p>📊 Track Expenses</p>
        <p>💵 Manage Income</p>
        <p>📈 Monitor Investments</p>
        <p>🏦 Track Assets</p>
        <p>🤖 AI Financial Assistant</p>
      </div>
    </main>
  );
}