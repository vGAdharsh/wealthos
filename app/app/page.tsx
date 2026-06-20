export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <h1 className="text-5xl font-bold mb-2">
        WealthOS 💰
      </h1>

      <p className="text-slate-400 mb-10">
        Your Personal Financial Operating System
      </p>

      {/* Dashboard Cards */}
      <div className="grid md:grid-cols-4 gap-6">

        <div className="bg-slate-900 p-6 rounded-2xl">
          <h2 className="text-slate-400">Total Balance</h2>
          <p className="text-3xl font-bold text-green-400">
            ₹0
          </p>
        </div>

        <div className="bg-slate-900 p-6 rounded-2xl">
          <h2 className="text-slate-400">Income</h2>
          <p className="text-3xl font-bold text-blue-400">
            ₹0
          </p>
        </div>

        <div className="bg-slate-900 p-6 rounded-2xl">
          <h2 className="text-slate-400">Expenses</h2>
          <p className="text-3xl font-bold text-red-400">
            ₹0
          </p>
        </div>

        <div className="bg-slate-900 p-6 rounded-2xl">
          <h2 className="text-slate-400">Investments</h2>
          <p className="text-3xl font-bold text-yellow-400">
            ₹0
          </p>
        </div>

      </div>

      {/* Modules */}
      <div className="mt-12 grid md:grid-cols-2 gap-6">

        <div className="bg-slate-900 rounded-2xl p-6">
          <h2 className="text-2xl font-semibold mb-4">
            💸 Expense Tracker
          </h2>

          <ul className="space-y-2 text-slate-300">
            <li>Food</li>
            <li>Transport</li>
            <li>Bills</li>
            <li>Shopping</li>
          </ul>
        </div>

        <div className="bg-slate-900 rounded-2xl p-6">
          <h2 className="text-2xl font-semibold mb-4">
            📈 Investments
          </h2>

          <ul className="space-y-2 text-slate-300">
            <li>Stocks</li>
            <li>Mutual Funds</li>
            <li>Gold</li>
            <li>Fixed Deposits</li>
          </ul>
        </div>

      </div>
    </main>
  );
}