"use client";

import { useState, useEffect, useMemo } from "react";

// Types
type Transaction = {
  id: number;
  type: "income" | "expense";
  category: string;
  description: string;
  amount: number;
  date: string;
  method: "cash" | "online";
};

export default function Home() {
  // State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeView, setActiveView] = useState("dashboard");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDrillDownOpen, setIsDrillDownOpen] = useState(false);
  const [drillDownData, setDrillDownData] = useState<{ label: string; type: "month" | "category"; items: Transaction[] }>({
    label: "",
    type: "category",
    items: [],
  });
  
  // Auth & Storage Mode State
  const [userKey, setUserKey] = useState<string | null>(null);
  const [storageMode, setStorageMode] = useState<"local" | "online">("local");
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [tempKey, setTempKey] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    type: "income",
    category: "",
    description: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    method: "online",
  });

  const [isLoading, setIsLoading] = useState(true);

  // Initial Auth Check
  useEffect(() => {
    const savedKey = localStorage.getItem("finance_user_key");
    if (savedKey) {
      validateAndLoad(savedKey);
    } else {
      setIsAuthModalOpen(true);
      setIsLoading(false);
    }
  }, []);

  const validateAndLoad = async (key: string) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const res = await fetch("/api/transactions", {
        headers: { "x-user-key": key }
      });
      
      if (res.ok) {
        const data = await res.json();
        console.log("✅ Storage Connected: Online Mode (Vercel KV)");
        setTransactions(data || []);
        setUserKey(key);
        setStorageMode("online");
        localStorage.setItem("finance_user_key", key);
        setIsAuthModalOpen(false);
      } else {
        console.error("❌ Auth Failed");
        setAuthError("Invalid Access Key. Please check your Vercel Environment Variables.");
        setIsAuthModalOpen(true);
      }
    } catch (err) {
      console.error("❌ Connection Error:", err);
      setAuthError("Connection error. Using local mode as fallback.");
      enterDemoMode();
    } finally {
      setIsLoading(false);
    }
  };

  const enterDemoMode = () => {
    console.log("⚠️ Storage Warning: Local Mode (Demo/Offline)");
    const localData = JSON.parse(localStorage.getItem("finance_transactions_local") || "[]");
    setTransactions(localData);
    setStorageMode("local");
    setUserKey(null);
    setIsAuthModalOpen(false);
  };

  const handleLogout = () => {
    if (confirm("Reset Access Key and switch to Demo Mode?")) {
      localStorage.removeItem("finance_user_key");
      window.location.reload();
    }
  };

  // Save Data helper
  const saveTransactions = async (newTransactions: Transaction[]) => {
    setTransactions(newTransactions);
    
    if (storageMode === "online" && userKey) {
      try {
        const res = await fetch("/api/transactions", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "x-user-key": userKey
          },
          body: JSON.stringify(newTransactions),
        });
        if (!res.ok) throw new Error("Sync failed");
      } catch (err) {
        console.error("❌ Online save error:", err);
      }
    } else {
      localStorage.setItem("finance_transactions_local", JSON.stringify(newTransactions));
    }
  };

  const handleDeleteTransaction = (id: number) => {
    if (confirm("Are you sure you want to delete this transaction?")) {
      const updated = transactions.filter(t => t.id !== id);
      saveTransactions(updated);
      // If drilldown is open, update its items too
      if (isDrillDownOpen) {
        setDrillDownData(prev => ({ ...prev, items: prev.items.filter(t => t.id !== id) }));
      }
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempKey.trim()) {
      validateAndLoad(tempKey);
    }
  };

  // Calculations
  const stats = useMemo(() => {
    let totalIncome = 0, totalExpense = 0, totalCash = 0, totalOnline = 0;
    let monthIncome = 0, monthExpense = 0, monthCash = 0, monthOnline = 0;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    transactions.forEach((t) => {
      const amt = parseFloat(t.amount as any);
      const tDate = new Date(t.date);
      const isCurrentMonth = tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;

      if (t.type === "income") {
        totalIncome += amt;
        if (t.method === "cash") totalCash += amt; else totalOnline += amt;
        if (isCurrentMonth) {
          monthIncome += amt;
          if (t.method === "cash") monthCash += amt; else monthOnline += amt;
        }
      } else {
        totalExpense += amt;
        if (t.method === "cash") totalCash -= amt; else totalOnline -= amt;
        if (isCurrentMonth) {
          monthExpense += amt;
          if (t.method === "cash") monthCash -= amt; else monthOnline -= amt;
        }
      }
    });

    const totalBalance = totalCash + totalOnline;
    const progressPercent = monthIncome > 0 ? Math.min(100, (monthExpense / monthIncome) * 100) : (monthExpense > 0 ? 100 : 0);

    return { totalBalance, totalCash, totalOnline, totalExpense, monthIncome, monthExpense, monthCash, monthOnline, progressPercent };
  }, [transactions]);

  // Grouped Transactions
  const groupedTransactions = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.id - a.id);
    const groups: Record<string, { items: Transaction[]; in: number; out: number }> = {};
    
    sorted.forEach((t) => {
      const monthYear = new Date(t.date).toLocaleString("default", { month: "long", year: "numeric" });
      if (!groups[monthYear]) groups[monthYear] = { items: [], in: 0, out: 0 };
      groups[monthYear].items.push(t);
      if (t.type === "income") groups[monthYear].in += t.amount;
      else groups[monthYear].out += t.amount;
    });
    return groups;
  }, [transactions]);

  // Report Data
  const reportData = useMemo(() => {
    const monthly: Record<string, { income: number; expense: number }> = {};
    const yearly: Record<string, { income: number; expense: number }> = {};
    const category: Record<string, { income: number; expense: number }> = {};

    transactions.forEach((t) => {
      const date = new Date(t.date);
      const mLabel = date.toLocaleString("default", { month: "long", year: "numeric" });
      const yLabel = date.getFullYear().toString();
      const cLabel = t.category || "Other";

      if (!monthly[mLabel]) monthly[mLabel] = { income: 0, expense: 0 };
      if (!yearly[yLabel]) yearly[yLabel] = { income: 0, expense: 0 };
      if (!category[cLabel]) category[cLabel] = { income: 0, expense: 0 };

      if (t.type === "income") {
        monthly[mLabel].income += t.amount;
        yearly[yLabel].income += t.amount;
        category[cLabel].income += t.amount;
      } else {
        monthly[mLabel].expense += t.amount;
        yearly[yLabel].expense += t.amount;
        category[cLabel].expense += t.amount;
      }
    });

    return { monthly, yearly, category };
  }, [transactions]);

  // Handlers
  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const newT: Transaction = {
      id: Date.now(),
      type: formData.type as "income" | "expense",
      category: formData.category || "Other",
      description: formData.description,
      amount: parseFloat(formData.amount),
      date: formData.date,
      method: formData.method as "cash" | "online",
    };
    saveTransactions([...transactions, newT]);
    setIsModalOpen(false);
    setFormData({ ...formData, description: "", amount: "", category: "" });
  };

  const openDrillDown = (label: string, type: "month" | "category") => {
    let items: Transaction[] = [];
    if (type === "category") {
      items = transactions.filter(t => (t.category || "Other") === label);
    } else {
      items = transactions.filter(t => new Date(t.date).toLocaleString("default", { month: "long", year: "numeric" }) === label);
    }
    setDrillDownData({ label, type, items: items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) });
    setIsDrillDownOpen(true);
  };

  const formatCurrency = (amt: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amt);
  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });

  if (isAuthModalOpen && !isLoading) {
    return (
      <div className="modal-overlay active">
        <div className="modal" style={{ textAlign: 'center' }}>
          <div className="logo" style={{ justifyContent: 'center', marginBottom: '2rem' }}>
            <div className="logo-icon">FF</div>
            <span>FinanceFlow</span>
          </div>
          <h2 style={{ marginBottom: '1rem' }}>Access Dashboard</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Enter your personal key or try the demo.</p>
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <input 
                type="password" 
                placeholder="Enter Personal Key..." 
                value={tempKey} 
                onChange={(e) => {setTempKey(e.target.value); setAuthError(null);}} 
                required 
                autoFocus
                style={{ borderColor: authError ? 'var(--expense-color)' : 'var(--glass-border)' }}
              />
              {authError && <p style={{ color: 'var(--expense-color)', fontSize: '0.8rem', marginTop: '0.5rem' }}>{authError}</p>}
            </div>
            <button type="submit" className="btn-submit">Unlock Private Mode</button>
            <button type="button" className="btn-submit" style={{ background: 'rgba(255,255,255,0.1)', marginTop: '0.5rem' }} onClick={() => enterDemoMode()}>Continue as Demo User</button>
          </form>
        </div>
      </div>
    );
  }

  if (isLoading) return <div className="loading" style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)', color: 'white' }}>Verifying Identity...</div>;

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-icon">FF</div>
          <span>FinanceFlow</span>
        </div>
        <nav>
          <ul className="nav-links">
            <li className={activeView === "dashboard" ? "active" : ""} onClick={() => setActiveView("dashboard")}>
              <i className="fas fa-th-large"></i> <span>Dashboard</span>
            </li>
            <li className={activeView === "transactions" ? "active" : ""} onClick={() => setActiveView("transactions")}>
              <i className="fas fa-exchange-alt"></i> <span>Transactions</span>
            </li>
            <li className={activeView === "reports" ? "active" : ""} onClick={() => setActiveView("reports")}>
              <i className="fas fa-chart-bar"></i> <span>Reports</span>
            </li>
            <li className={activeView === "settings" ? "active" : ""} onClick={() => setActiveView("settings")}>
              <i className="fas fa-cog"></i> <span>Settings</span>
            </li>
          </ul>
        </nav>
        
        <div className="user-profile" style={{ position: 'relative' }}>
          <div className="avatar" style={{ background: storageMode === 'online' ? 'var(--primary-color)' : 'orange' }}>
            {storageMode === 'online' ? 'G' : 'D'}
          </div>
          <div className="user-info">
            <p className="name">{storageMode === 'online' ? 'Ganesh' : 'Demo User'}</p>
            <p className="status">{storageMode === 'online' ? 'Private Cloud' : 'Local Storage'}</p>
          </div>
          <button onClick={handleLogout} title="Logout/Reset" style={{ position: 'absolute', right: '0', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
             <i className="fas fa-power-off"></i>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="top-header">
          <div className="greeting">
            <h1>Welcome, {storageMode === 'online' ? 'Ganesh' : 'Demo User'}!</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div className={`status-dot ${storageMode === 'online' ? 'online' : 'offline'}`}></div>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                {storageMode === 'online' ? "Cloud Sync Active" : "Demo Mode (Local Only)"}
              </p>
            </div>
          </div>
          <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
            <i className="fas fa-plus"></i> Add Transaction
          </button>
        </header>

        {/* Dashboard View */}
        {activeView === "dashboard" && (
          <div className="view active">
            <h3 className="section-title">This Month Overview</h3>
            <section className="stats-grid monthly-grid">
              <div className="stat-card month-income">
                <div className="card-header"><span>Month Income</span><i className="fas fa-arrow-up"></i></div>
                <h2>{formatCurrency(stats.monthIncome)}</h2>
                <p className="card-footer">{new Date().toLocaleString("default", { month: "long", year: "numeric" })}</p>
              </div>
              <div className="stat-card month-expense">
                <div className="card-header"><span>Month Expenses</span><i className="fas fa-arrow-down"></i></div>
                <h2>{formatCurrency(stats.monthExpense)}</h2>
                <p className="card-footer">Spent this month</p>
              </div>
              <div className="stat-card month-savings">
                <div className="card-header"><span>Month Savings</span><i className="fas fa-piggy-bank"></i></div>
                <h2>{formatCurrency(stats.monthIncome - stats.monthExpense)}</h2>
                <p className="card-footer">Saved this month</p>
              </div>
              <div className="stat-card month-cash">
                <div className="card-header"><span>Month Cash</span><i className="fas fa-money-bill-wave"></i></div>
                <h2>{formatCurrency(stats.monthCash)}</h2>
                <p className="card-footer">Cash left this month</p>
              </div>
              <div className="stat-card month-online">
                <div className="card-header"><span>Month Online</span><i className="fas fa-mobile-alt"></i></div>
                <h2>{formatCurrency(stats.monthOnline)}</h2>
                <p className="card-footer">Online left this month</p>
              </div>
            </section>

            <section className="progress-section">
              <div className="report-card progress-card">
                <div className="progress-header">
                  <h3>Monthly Budget Progress</h3>
                  <span>{new Date().toLocaleString("default", { month: "long", year: "numeric" })}</span>
                </div>
                <div className="progress-stats">
                  <div className="p-stat">
                    <span className="label">Monthly Income</span>
                    <span className="amount-income">{formatCurrency(stats.monthIncome)}</span>
                  </div>
                  <div className="p-stat">
                    <span className="label">Monthly Expense</span>
                    <span className="amount-expense">{formatCurrency(stats.monthExpense)}</span>
                  </div>
                </div>
                <div className="progress-bar-container">
                  <div className="progress-bar" style={{ width: `${stats.progressPercent}%` }}></div>
                </div>
                <p className="progress-text">You've spent {stats.progressPercent.toFixed(0)}% of your monthly income.</p>
              </div>
            </section>

            <h3 className="section-title">Total Overall Summary</h3>
            <section className="stats-grid">
              <div className="stat-card total-balance">
                <div className="card-header"><span>Total Balance</span><i className="fas fa-wallet"></i></div>
                <h2>{formatCurrency(stats.totalBalance)}</h2>
                <p className="card-footer">Across all methods</p>
              </div>
              <div className="stat-card cash-balance">
                <div className="card-header"><span>Total Cash</span><i className="fas fa-money-bill-wave"></i></div>
                <h2>{formatCurrency(stats.totalCash)}</h2>
                <p className="card-footer">{(stats.totalBalance > 0 ? (stats.totalCash / stats.totalBalance) * 100 : 0).toFixed(0)}% of total</p>
              </div>
              <div className="stat-card online-balance">
                <div className="card-header"><span>Total Online</span><i className="fas fa-mobile-alt"></i></div>
                <h2>{formatCurrency(stats.totalOnline)}</h2>
                <p className="card-footer">{(stats.totalBalance > 0 ? (stats.totalOnline / stats.totalBalance) * 100 : 0).toFixed(0)}% of total</p>
              </div>
              <div className="stat-card total-expense">
                <div className="card-header"><span>Total Expenses</span><i className="fas fa-arrow-down"></i></div>
                <h2>{formatCurrency(stats.totalExpense)}</h2>
                <p className="card-footer">Overall</p>
              </div>
            </section>

            <section className="transactions-section">
              <div className="section-header"><h3>Recent Activity</h3><button className="btn-text" onClick={() => setActiveView("transactions")}>View All</button></div>
              <div className="transaction-list">
                {transactions.length === 0 ? <div className="empty-state">No transactions yet.</div> : 
                  Object.keys(groupedTransactions).slice(0, 1).map(m => (
                    <div key={m} className="transaction-group">
                       <div className="group-header-row">
                          <h4 className="group-header">{m}</h4>
                       </div>
                       {groupedTransactions[m].items.slice(0, 5).map(t => (
                         <div key={t.id} className="transaction-item">
                            <div className={`item-icon ${t.type === 'income' ? 'icon-income' : 'icon-expense'}`}><i className={`fas ${t.type === 'income' ? 'fa-arrow-up' : 'fa-arrow-down'}`}></i></div>
                            <div className="item-info">
                              <h4>{t.description}</h4>
                              <p>{formatDate(t.date)} | <span style={{ color: 'var(--primary-color)', fontWeight: 600 }}>{t.category}</span></p>
                            </div>
                            <div className="item-action-group" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                              <div className={`item-amount ${t.type === 'income' ? 'amount-income' : 'amount-expense'}`}>{t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}</div>
                              <button className="btn-delete" onClick={() => handleDeleteTransaction(t.id)} title="Delete"><i className="fas fa-trash-alt"></i></button>
                            </div>
                         </div>
                       ))}
                    </div>
                  ))
                }
              </div>
            </section>
          </div>
        )}

        {/* Transactions View */}
        {activeView === "transactions" && (
          <div className="view active">
            <h2 className="section-title">All Transactions</h2>
            <div className="transaction-list">
              {Object.keys(groupedTransactions).map(m => (
                <div key={m} className="transaction-group">
                  <div className="group-header-row">
                    <h4 className="group-header">{m}</h4>
                    <div className="group-summary">
                      <span className="amount-income">IN: {formatCurrency(groupedTransactions[m].in)}</span>
                      <span className="amount-expense">OUT: {formatCurrency(groupedTransactions[m].out)}</span>
                    </div>
                  </div>
                  {groupedTransactions[m].items.map(t => (
                    <div key={t.id} className="transaction-item">
                      <div className={`item-icon ${t.type === 'income' ? 'icon-income' : 'icon-expense'}`}><i className={`fas ${t.type === 'income' ? 'fa-arrow-up' : 'fa-arrow-down'}`}></i></div>
                      <div className="item-info">
                        <h4>{t.description}</h4>
                        <p>{formatDate(t.date)} | <span style={{ color: 'var(--primary-color)', fontWeight: 600 }}>{t.category}</span></p>
                      </div>
                      <div className="item-action-group" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div className={`item-amount ${t.type === 'income' ? 'amount-income' : 'amount-expense'}`}>{t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}</div>
                        <button className="btn-delete" onClick={() => handleDeleteTransaction(t.id)} title="Delete"><i className="fas fa-trash-alt"></i></button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reports View */}
        {activeView === "reports" && (
          <div className="view active">
            <h2 className="section-title">Reports & Analytics</h2>
            <div className="reports-container">
              <div className="report-card">
                <h3>Monthly Summary</h3>
                <div className="monthly-reports">
                  <div className="report-row header"><span>Label</span><span>Income</span><span>Expense</span><span>Net</span></div>
                  {Object.keys(reportData.monthly).reverse().map(m => (
                    <div key={m} className="report-row">
                      <span><span className="clickable-cat" onClick={() => openDrillDown(m, "month")}>{m}</span></span>
                      <span className="amount-income">+{formatCurrency(reportData.monthly[m].income)}</span>
                      <span className="amount-expense">-{formatCurrency(reportData.monthly[m].expense)}</span>
                      <span style={{ fontWeight: 700 }}>{formatCurrency(reportData.monthly[m].income - reportData.monthly[m].expense)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="report-card">
                <h3>Category Analytics</h3>
                <div className="category-reports">
                  <div className="report-row header"><span>Label</span><span>Income</span><span>Expense</span><span>Net</span></div>
                  {Object.keys(reportData.category).sort((a, b) => reportData.category[b].expense - reportData.category[a].expense).map(c => (
                    <div key={c} className="report-row">
                      <span><span className="clickable-cat" onClick={() => openDrillDown(c, "category")}>{c}</span></span>
                      <span className="amount-income">+{formatCurrency(reportData.category[c].income)}</span>
                      <span className="amount-expense">-{formatCurrency(reportData.category[c].expense)}</span>
                      <span style={{ fontWeight: 700 }}>{formatCurrency(reportData.category[c].income - reportData.category[c].expense)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Settings View */}
        {activeView === "settings" && (
          <div className="view active">
             <h2 className="section-title">Settings</h2>
             <div className="report-card">
               <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
                 <button className="btn-primary" onClick={handleLogout}>{storageMode === 'online' ? 'Logout (Exit Private Mode)' : 'Switch to Private Mode'}</button>
                 <button className="btn-primary" onClick={() => {
                   const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(transactions));
                   const downloadAnchorNode = document.createElement('a');
                   downloadAnchorNode.setAttribute("href", dataStr);
                   downloadAnchorNode.setAttribute("download", `finance_data_${storageMode}.json`);
                   document.body.appendChild(downloadAnchorNode);
                   downloadAnchorNode.click();
                   downloadAnchorNode.remove();
                 }}>Export Data (JSON)</button>
                 <button className="btn-primary" style={{ background: 'var(--expense-color)' }} onClick={() => {
                   if (confirm(`Delete all ${storageMode} data?`)) saveTransactions([]);
                 }}>Clear All {storageMode === 'online' ? 'Cloud' : 'Local'} Data</button>
               </div>
             </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {isModalOpen && (
        <div className="modal-overlay active" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Transaction</h2>
              <button className="btn-close" onClick={() => setIsModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleAddTransaction}>
               <div className="form-group">
                 <label>Transaction Type</label>
                 <div className="type-toggle">
                   <input type="radio" id="type-income" name="type" value="income" checked={formData.type === 'income'} onChange={(e) => setFormData({...formData, type: e.target.value})} />
                   <label htmlFor="type-income">Income</label>
                   <input type="radio" id="type-expense" name="type" value="expense" checked={formData.type === 'expense'} onChange={(e) => setFormData({...formData, type: e.target.value})} />
                   <label htmlFor="type-expense">Expense</label>
                 </div>
               </div>
               <div className="form-row">
                 <div className="form-group">
                   <label htmlFor="amount">Amount (₹)</label>
                   <input type="number" id="amount" required placeholder="0.00" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} />
                 </div>
                 <div className="form-group">
                   <label htmlFor="date">Date</label>
                   <input type="date" id="date" required value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
                 </div>
               </div>
               <div className="form-group">
                 <label htmlFor="description">Description</label>
                 <input type="text" id="description" required placeholder="What was this for?" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
               </div>
               <div className="form-group">
                 <label htmlFor="category">Category</label>
                 <select id="category" className="form-select" required value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}>
                    <option value="" disabled>Select Category</option>
                    <optgroup label="People">
                      <option value="Father">Father</option><option value="Mother">Mother</option><option value="Brother">Brother</option><option value="Myself">Myself</option>
                    </optgroup>
                    <optgroup label="Family & Home">
                      <option value="Family">Family (Groceries)</option><option value="Repair">Repair</option>
                    </optgroup>
                    <optgroup label="Health & Food">
                      <option value="Medicine">Medicine</option><option value="Online Food">Online Food</option>
                    </optgroup>
                    <optgroup label="Others">
                      <option value="Bill/Rent">Bill/Rent</option><option value="Other">Other</option>
                    </optgroup>
                 </select>
               </div>
               <div className="form-group">
                 <label>Payment Method</label>
                 <div className="method-toggle">
                   <input type="radio" id="method-cash" name="method" value="cash" checked={formData.method === 'cash'} onChange={(e) => setFormData({...formData, method: e.target.value as any})} />
                   <label htmlFor="method-cash">Cash</label>
                   <input type="radio" id="method-online" name="method" value="online" checked={formData.method === 'online'} onChange={(e) => setFormData({...formData, method: e.target.value as any})} />
                   <label htmlFor="method-online">Online</label>
                 </div>
               </div>
               <button type="submit" className="btn-submit">Save Transaction</button>
            </form>
          </div>
        </div>
      )}

      {/* DrillDown Modal */}
      {isDrillDownOpen && (
        <div className="modal-overlay active" onClick={() => setIsDrillDownOpen(false)}>
          <div className="modal detail-modal" onClick={(e) => e.stopPropagation()}>
             <div className="modal-header">
               <h2>{drillDownData.label} History</h2>
               <button className="btn-close" onClick={() => setIsDrillDownOpen(false)}>&times;</button>
             </div>
             <div className="modal-summary">
               <div className="summary-item"><span className="label">Income</span><span className="val amount-income">+{formatCurrency(drillDownData.items.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0))}</span></div>
               <div className="summary-item"><span className="label">Expense</span><span className="val amount-expense">-{formatCurrency(drillDownData.items.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0))}</span></div>
               <div className="summary-item"><span className="label">Net</span><span className="val">{formatCurrency(drillDownData.items.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0))}</span></div>
             </div>
             <div className="modal-body">
               <div className="transaction-list">
                 {drillDownData.items.map(t => (
                   <div key={t.id} className="transaction-item" style={{ background: 'rgba(0,0,0,0.2)' }}>
                     <div className={`item-icon ${t.type === 'income' ? 'icon-income' : 'icon-expense'}`}><i className={`fas ${t.type === 'income' ? 'fa-arrow-up' : 'fa-arrow-down'}`}></i></div>
                     <div className="item-info">
                       <h4>{t.description}</h4>
                       <p>{formatDate(t.date)} | <small>{t.category}</small></p>
                     </div>
                     <div className="item-action-group" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div className={`item-amount ${t.type === 'income' ? 'amount-income' : 'amount-expense'}`}>{t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}</div>
                        <button className="btn-delete" onClick={() => handleDeleteTransaction(t.id)} title="Delete"><i className="fas fa-trash-alt"></i></button>
                      </div>
                   </div>
                 ))}
               </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
