"use client";

import { useState, useEffect } from "react";

export default function IncomePage() {
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState("");

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

  useEffect(() => {
    localStorage.setItem("income", JSON.stringify(income));
  }, [income]);

  function addIncome() {
    if (!amount || !source) return;

    setIncome([
      ...income,
      {
        amount,
        source,
      },
    ]);

    setAmount("");
    setSource("");
  }

  function deleteIncome(index: number) {
    const updatedIncome = income.filter((_, i) => i !== index);
    setIncome(updatedIncome);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <h1 className="text-4xl font-bold mb-8">
        Income Tracker 💵
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
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="w-full p-3 rounded bg-slate-800"
        >
          <option value="">Select Source</option>
          <option>Salary</option>
          <option>Freelance</option>
          <option>Business</option>
          <option>Interest</option>
          <option>Other</option>
        </select>

        <button
          onClick={addIncome}
          className="bg-green-600 px-5 py-3 rounded"
        >
          Add Income
        </button>
      </div>

      <div className="mt-10 space-y-3">
        {income.map((item, index) => (
          <div
            key={index}
            className="bg-slate-900 p-4 rounded-xl flex justify-between"
          >
            <span>
              ₹{item.amount} • {item.source}
            </span>

            <button
              onClick={() => deleteIncome(index)}
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