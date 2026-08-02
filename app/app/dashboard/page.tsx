"use client";

import { useState, useEffect } from "react";

export default function Dashboard() {
  const [expenses, setExpenses] = useState<
  {
    amount: string;
    category: string;
  }[]
>([]);
useEffect(() => {
  const savedExpenses = localStorage.getItem("expenses");

  if (savedExpenses) {
    setExpenses(JSON.parse(savedExpenses));
  }
}, []);
const [income, setIncome] = useState<
  {
    amount: string;
    source: string;
  }[]
>([]);

useEffect(() => {
  const savedIncome = localStorage.getItem("income");

  if (savedIncome) {
    setIncome(JSON.parse(savedIncome));
  }
}, []);

const totalIncome = income.reduce(
  (sum, item) => sum + Number(item.amount),
  0
);
const totalExpenses = expenses.reduce(
  (sum, expense) => sum + Number(expense.amount),
  0
);
  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">

      <h1 className="text-4xl font-bold mb-8">
        WealthOS Dashboard 💰
      </h1>

      <div className="grid md:grid-cols-4 gap-6">

        <div className="bg-slate-900 p-6 rounded-2xl">
          <h2>Total Balance</h2>
          <p className="text-3xl text-green-400 font-bold">
            ₹{totalIncome - totalExpenses}
          </p>
        </div>

        <div className="bg-slate-900 p-6 rounded-2xl">
          <h2>Income</h2>
          <p className="text-3xl text-blue-400 font-bold">
            ₹{totalIncome}
          </p>
        </div>

        <div className="bg-slate-900 p-6 rounded-2xl">
          <h2>Expenses</h2>
          <p className="text-3xl text-red-400 font-bold">
            ₹{totalExpenses}
          </p>
        </div>

        <div className="bg-slate-900 p-6 rounded-2xl">
          <h2>Investments</h2>
          <p className="text-3xl text-yellow-400 font-bold">
            ₹0
          </p>
        </div>

      </div>

    </main>
  );
}