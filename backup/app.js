// State Management
let transactions = JSON.parse(localStorage.getItem('transactions')) || [];

// DOM Elements
const totalBalanceEl = document.getElementById('total-balance-val');
const cashBalanceEl = document.getElementById('cash-balance-val');
const onlineBalanceEl = document.getElementById('online-balance-val');
const totalExpenseEl = document.getElementById('total-expense-val');
const cashPercentageEl = document.getElementById('cash-percentage');
const onlinePercentageEl = document.getElementById('online-percentage');

const recentTransactionListEl = document.getElementById('recent-transaction-list');
const allTransactionListEl = document.getElementById('all-transaction-list');
const monthlyReportsEl = document.getElementById('monthly-reports');
const yearlyReportsEl = document.getElementById('yearly-reports');
const categoryReportsEl = document.getElementById('category-reports');

const transactionForm = document.getElementById('transaction-form');
const modalOverlay = document.getElementById('modal-overlay');
const categoryModal = document.getElementById('category-modal');
const closeModalBtn = document.getElementById('close-modal');
const closeCatModalBtn = document.getElementById('close-cat-modal');
const navLinks = document.querySelectorAll('.nav-links li');
const views = document.querySelectorAll('.view');
const addBtns = document.querySelectorAll('.add-btn');

// Initialize App
function init() {
    updateUI();
    document.getElementById('date').valueAsDate = new Date();
    setupEventListeners();
}

function setupEventListeners() {
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            const viewId = link.getAttribute('data-view');
            switchView(viewId);
        });
    });

    addBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modalOverlay.classList.add('active');
        });
    });

    closeModalBtn.addEventListener('click', closeModal);
    closeCatModalBtn.addEventListener('click', closeCategoryModal);
    
    window.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
        if (e.target === categoryModal) closeCategoryModal();
    });

    transactionForm.addEventListener('submit', handleFormSubmit);
}

function switchView(viewId) {
    views.forEach(view => view.classList.remove('active'));
    navLinks.forEach(link => link.classList.remove('active'));

    const activeView = document.getElementById(`${viewId}-view`);
    const activeLink = document.querySelector(`[data-view="${viewId}"]`);

    if (activeView) activeView.classList.add('active');
    if (activeLink) activeLink.classList.add('active');

    if (viewId === 'reports') renderReports();
}

function updateUI() {
    calculateStats();
    renderTransactions();
    if (document.getElementById('reports-view').classList.contains('active')) {
        renderReports();
    }
}

function calculateStats() {
    let totalIncome = 0;
    let totalExpense = 0;
    let totalCash = 0;
    let totalOnline = 0;

    let monthIncome = 0;
    let monthExpense = 0;
    let monthCash = 0;
    let monthOnline = 0;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    transactions.forEach(t => {
        const amt = parseFloat(t.amount);
        const tDate = new Date(t.date);
        const isCurrentMonth = tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;

        if (t.type === 'income') {
            totalIncome += amt;
            if (t.method === 'cash') totalCash += amt;
            else totalOnline += amt;

            if (isCurrentMonth) {
                monthIncome += amt;
                if (t.method === 'cash') monthCash += amt;
                else monthOnline += amt;
            }
        } else {
            totalExpense += amt;
            if (t.method === 'cash') totalCash -= amt;
            else totalOnline -= amt;

            if (isCurrentMonth) {
                monthExpense += amt;
                if (t.method === 'cash') monthCash -= amt;
                else monthOnline -= amt;
            }
        }
    });

    const totalBalance = totalCash + totalOnline;

    totalBalanceEl.innerText = formatCurrency(totalBalance);
    cashBalanceEl.innerText = formatCurrency(totalCash);
    onlineBalanceEl.innerText = formatCurrency(totalOnline);
    totalExpenseEl.innerText = formatCurrency(totalExpense);

    if (totalBalance > 0) {
        cashPercentageEl.innerText = `${Math.max(0, (totalCash / totalBalance) * 100).toFixed(0)}% of total`;
        onlinePercentageEl.innerText = `${Math.max(0, (totalOnline / totalBalance) * 100).toFixed(0)}% of total`;
    }

    const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });
    document.getElementById('month-name-label').innerText = monthName;
    document.getElementById('current-month-name').innerText = monthName;

    document.getElementById('month-income-val').innerText = formatCurrency(monthIncome);
    document.getElementById('month-expense-val').innerText = formatCurrency(monthExpense);
    document.getElementById('month-savings-val').innerText = formatCurrency(monthIncome - monthExpense);
    document.getElementById('month-cash-val').innerText = formatCurrency(monthCash);
    document.getElementById('month-online-val').innerText = formatCurrency(monthOnline);

    document.getElementById('dash-month-income').innerText = formatCurrency(monthIncome);
    document.getElementById('dash-month-expense').innerText = formatCurrency(monthExpense);

    const progressPercent = monthIncome > 0 ? Math.min(100, (monthExpense / monthIncome) * 100) : (monthExpense > 0 ? 100 : 0);
    const progressBar = document.getElementById('dash-progress-bar');
    progressBar.style.width = `${progressPercent}%`;
    
    if (progressPercent >= 100) progressBar.style.background = 'var(--expense-color)';
    else if (progressPercent >= 80) progressBar.style.background = 'orange';
    else progressBar.style.background = 'linear-gradient(90deg, var(--primary-color), var(--secondary-color))';

    document.getElementById('dash-progress-text').innerText = monthIncome > 0 
        ? `You've spent ${progressPercent.toFixed(0)}% of your monthly income.`
        : (monthExpense > 0 ? "You have expenses but no income recorded this month." : "No activity recorded this month.");
}

function renderTransactions() {
    const sorted = [...transactions].sort((a, b) => {
        const dateDiff = new Date(b.date) - new Date(a.date);
        if (dateDiff !== 0) return dateDiff;
        return b.id - a.id;
    });

    const grouped = {};
    sorted.forEach(t => {
        const date = new Date(t.date);
        const monthYear = date.toLocaleString('default', { month: 'long', year: 'numeric' });
        if (!grouped[monthYear]) {
            grouped[monthYear] = { items: [], in: 0, out: 0 };
        }
        grouped[monthYear].items.push(t);
        const amt = parseFloat(t.amount);
        if (t.type === 'income') grouped[monthYear].in += amt;
        else grouped[monthYear].out += amt;
    });

    const renderItem = (t) => `
        <div class="transaction-item">
            <div class="item-icon ${t.type === 'income' ? 'icon-income' : 'icon-expense'}">
                <i class="fas ${t.type === 'income' ? 'fa-arrow-up' : 'fa-arrow-down'}"></i>
            </div>
            <div class="item-info">
                <h4>${t.description}</h4>
                <p>${formatDate(t.date)} | <span style="color: var(--primary-color); font-weight: 600;">${t.category || 'Other'}</span></p>
                <span class="item-method">${t.method}</span>
            </div>
            <div class="item-amount ${t.type === 'income' ? 'amount-income' : 'amount-expense'}">
                ${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}
            </div>
        </div>
    `;

    const renderGroup = (monthYear, groupData) => `
        <div class="transaction-group">
            <div class="group-header-row">
                <h4 class="group-header">${monthYear}</h4>
                <div class="group-summary">
                    <span class="amount-income">IN: ${formatCurrency(groupData.in)}</span>
                    <span class="amount-expense">OUT: ${formatCurrency(groupData.out)}</span>
                    <span style="color: ${groupData.in - groupData.out >= 0 ? 'var(--primary-color)' : 'var(--expense-color)'}">BAL: ${formatCurrency(groupData.in - groupData.out)}</span>
                </div>
            </div>
            ${groupData.items.map(renderItem).join('')}
        </div>
    `;

    const months = Object.keys(grouped);
    let count = 0;
    const dashboardHtml = months.map(m => {
        const itemsToShow = grouped[m].items.filter(() => count++ < 5);
        if (itemsToShow.length === 0) return '';
        // Dashboard doesn't need the summary bar usually, but let's keep it simple
        return renderGroup(m, { items: itemsToShow, in: grouped[m].in, out: grouped[m].out });
    }).join('');

    const allHtml = months.map(m => renderGroup(m, grouped[m])).join('');

    recentTransactionListEl.innerHTML = transactions.length ? dashboardHtml : '<div class="empty-state">No transactions yet.</div>';
    allTransactionListEl.innerHTML = transactions.length ? allHtml : '<div class="empty-state">No transactions yet.</div>';
}

function renderReports() {
    const monthlyData = {};
    const yearlyData = {};
    const categoryData = {};

    transactions.forEach(t => {
        const date = new Date(t.date);
        const monthYear = date.toLocaleString('default', { month: 'long', year: 'numeric' });
        const monthYearShort = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
        const year = `${date.getFullYear()}`;
        const category = t.category || 'Other';

        if (!monthlyData[monthYear]) monthlyData[monthYear] = { income: 0, expense: 0, labelShort: monthYearShort };
        if (!yearlyData[year]) yearlyData[year] = { income: 0, expense: 0 };
        if (!categoryData[category]) categoryData[category] = { income: 0, expense: 0 };

        const amt = parseFloat(t.amount);
        if (t.type === 'income') {
            monthlyData[monthYear].income += amt;
            yearlyData[year].income += amt;
            categoryData[category].income += amt;
        } else {
            monthlyData[monthYear].expense += amt;
            yearlyData[year].expense += amt;
            categoryData[category].expense += amt;
        }
    });

    const renderRow = (label, data, drillDownType) => `
        <div class="report-row">
            <span>
                ${drillDownType ? `<span class="clickable-cat" onclick="showDrillDown('${label}', '${drillDownType}')">${label}</span>` : label}
            </span>
            <span class="amount-income">${data.income > 0 ? '+' + formatCurrency(data.income) : '-'}</span>
            <span class="amount-expense">${data.expense > 0 ? '-' + formatCurrency(data.expense) : '-'}</span>
            <span style="font-weight: 700;">${formatCurrency(data.income - data.expense)}</span>
        </div>
    `;

    const header = `<div class="report-row header"><span>Label</span><span>Income</span><span>Expense</span><span>Net</span></div>`;

    monthlyReportsEl.innerHTML = header + Object.keys(monthlyData).reverse().map(m => renderRow(m, monthlyData[m], 'month')).join('');
    yearlyReportsEl.innerHTML = header + Object.keys(yearlyData).reverse().map(y => renderRow(y, yearlyData[y])).join('');
    
    const sortedCategories = Object.keys(categoryData).sort((a, b) => categoryData[b].expense - categoryData[a].expense);
    categoryReportsEl.innerHTML = header + sortedCategories.map(c => renderRow(c, categoryData[c], 'category')).join('');
}

function showDrillDown(label, type) {
    let filtered = [];
    if (type === 'category') {
        filtered = transactions.filter(t => (t.category || 'Other') === label);
    } else if (type === 'month') {
        filtered = transactions.filter(t => {
            const date = new Date(t.date);
            return date.toLocaleString('default', { month: 'long', year: 'numeric' }) === label;
        });
    }

    const sorted = filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Calculate Summary
    let income = 0, expense = 0;
    filtered.forEach(t => {
        if (t.type === 'income') income += parseFloat(t.amount);
        else expense += parseFloat(t.amount);
    });

    document.getElementById('cat-modal-title').innerText = `${label} Transactions`;
    
    document.getElementById('cat-modal-summary').innerHTML = `
        <div class="summary-item">
            <span class="label">Total Income</span>
            <span class="val amount-income">+${formatCurrency(income)}</span>
        </div>
        <div class="summary-item">
            <span class="label">Total Expense</span>
            <span class="val amount-expense">-${formatCurrency(expense)}</span>
        </div>
        <div class="summary-item">
            <span class="label">Net Balance</span>
            <span class="val" style="color: ${income - expense >= 0 ? 'var(--primary-color)' : 'var(--expense-color)'}">${formatCurrency(income - expense)}</span>
        </div>
    `;

    const renderItem = (t) => `
        <div class="transaction-item" style="background: rgba(0,0,0,0.2);">
            <div class="item-icon ${t.type === 'income' ? 'icon-income' : 'icon-expense'}">
                <i class="fas ${t.type === 'income' ? 'fa-arrow-up' : 'fa-arrow-down'}"></i>
            </div>
            <div class="item-info">
                <h4>${t.description}</h4>
                <p>${formatDate(t.date)} | <small>${t.category || 'Other'}</small></p>
                <span class="item-method">${t.method}</span>
            </div>
            <div class="item-amount ${t.type === 'income' ? 'amount-income' : 'amount-expense'}">
                ${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}
            </div>
        </div>
    `;

    document.getElementById('cat-detail-list').innerHTML = sorted.length ? sorted.map(renderItem).join('') : '<div class="empty-state">No transactions found.</div>';
    categoryModal.classList.add('active');
}

function closeCategoryModal() {
    categoryModal.classList.remove('active');
}

function handleFormSubmit(e) {
    e.preventDefault();
    const newTransaction = {
        id: Date.now(),
        type: document.querySelector('input[name="type"]:checked').value,
        category: document.getElementById('category').value,
        description: document.getElementById('description').value,
        amount: parseFloat(document.getElementById('amount').value),
        date: document.getElementById('date').value,
        method: document.querySelector('input[name="method"]:checked').value
    };
    transactions.push(newTransaction);
    saveData();
    updateUI();
    closeModal();
    transactionForm.reset();
    document.getElementById('date').valueAsDate = new Date();
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

function saveData() {
    localStorage.setItem('transactions', JSON.stringify(transactions));
}

function closeModal() {
    modalOverlay.classList.remove('active');
}

window.exportData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(transactions));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "finance_data.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
};

window.clearAllData = () => {
    if (confirm('Are you sure? This will delete all your data!')) {
        transactions = [];
        saveData();
        updateUI();
    }
};

window.switchView = switchView;
window.showDrillDown = showDrillDown;
init();
