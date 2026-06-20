import Link from "next/link";

export default function Sidebar() {
  return (
    <aside className="w-64 min-h-screen bg-slate-900 text-white p-6">
      <h1 className="text-3xl font-bold mb-8">
        WealthOS 💰
      </h1>

      <nav className="space-y-4 text-lg">
        <Link href="/dashboard" className="block hover:text-green-400">
          📊 Dashboard
        </Link>

        <Link href="/expenses" className="block hover:text-green-400">
          💸 Expenses
        </Link>

        <Link href="/income" className="block hover:text-green-400">
          💵 Income
        </Link>

        <Link href="/investments" className="block hover:text-green-400">
          📈 Investments
        </Link>

        <Link href="/assets" className="block hover:text-green-400">
          🏠 Assets
        </Link>

        <Link href="/ai" className="block hover:text-green-400">
          🤖 AI Assistant
        </Link>
      </nav>
    </aside>
  );
}