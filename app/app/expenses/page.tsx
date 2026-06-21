"use client";

import { useState, useEffect } from "react";

export default function ExpensesPage() {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [expenses, setExpenses] = useState<
    { amount: string; category: string }[]
  >([]);
  useEffect(() => {
  const savedExpenses = localStorage.getItem("expenses");

  if (savedExpenses) {
    setExpenses(JSON.parse(savedExpenses));
  }
}, []);

useEffect(() => {
  localStorage.setItem("expenses", JSON.stringify(expenses));
}, [expenses]);

  function addExpense() {
    if (!amount || !category) return;

    setExpenses([
      ...expenses,
      {
        amount,
        category,
      },
    ]);

    setAmount("");
    setCategory("");
  }
function deleteExpense(index: number) {
  const updatedExpenses = expenses.filter(
    (_, i) => i !== index
  );

  setExpenses(updatedExpenses);
}
  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <h1 className="text-4xl font-bold mb-8">
        Expense Tracker 💸
      </h1>

      <div className="bg-slate-900 rounded-2xl p-6 max-w-xl space-y-4">

        <input
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full p-3 rounded bg-slate-800"
        />

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full p-3 rounded bg-slate-800"
        >
          <option value="">Select Category</option>
          <option>Food</option>
          <option>Transport</option>
          <option>Bills</option>
          <option>Shopping</option>
        </select>

        <button
          onClick={addExpense}
          className="bg-green-600 px-5 py-3 rounded"
        >
          Add Expense
        </button>
      </div>

      <div className="mt-10 space-y-3">
        {expenses.map((expense, index) => (
         <div
  key={index}
  className="bg-slate-900 p-4 rounded-xl flex justify-between"
>
  <span>
    ₹{expense.amount} • {expense.category}
  </span>

  <button
    onClick={() => deleteExpense(index)}
    className="text-red-400"
  >
    ❌
  </button>
</div>
        ))}
      </div>
    </main>
  );
}