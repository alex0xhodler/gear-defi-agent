import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

/**
 * Gearbox Strategy Agent — Full App Flow (Chat-first Fintech Dashboard)
 *
 * Improvements:
 * - Chat-first onboarding (fintech dashboard style): user speaks, selects templates, or types intent.
 * - Mandate preview auto-filled from chat templates and editable inline.
 * - Opportunity feed limited to 2-3 curated mock opportunities (no infinite spam).
 * - Reuses SignMandate / ProposalDetail / TxProgress concepts from prior version.
 *
 * Notes: Tailwind classes are used. In production split into modules and add TypeScript + real wallet integrations.
 */

/* ----------------------------
   Minimal UI primitives
   ----------------------------*/
const Badge = ({ children, tone = "neutral" }) => {
  const toneMap = {
    neutral: "bg-gray-100 text-gray-800",
    success: "bg-green-100 text-green-800",
    warning: "bg-yellow-100 text-yellow-800",
    danger: "bg-red-100 text-red-800",
    accent: "bg-indigo-50 text-indigo-700",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${toneMap[tone]}`}>
      {children}
    </span>
  );
};
const Field = ({ label, children }) => (
  <div className="flex flex-col gap-1">
    <div className="text-xs text-gray-500">{label}</div>
    <div className="text-sm text-gray-900">{children}</div>
  </div>
);

/* Smart Empty State - Progressive disclosure based on user journey */
const OpportunityEmptyState = ({ hasMandate, isScanning, onCreateMandate }) => {
  if (!hasMandate) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Ready to Start Earning?</h3>
        <p className="text-sm text-gray-600 max-w-md mb-6">
          Create your first mandate to start finding high-yield opportunities. Tell the agent what you want using the assistant on the left.
        </p>
        <button
          onClick={onCreateMandate}
          className="px-6 py-3 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-medium"
        >
          Create Your First Mandate
        </button>
      </div>
    );
  }

  if (isScanning) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mb-4 animate-pulse">
          <svg className="w-8 h-8 text-indigo-600 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Scanning for Opportunities</h3>
        <p className="text-sm text-gray-600 max-w-md">
          Analyzing 47+ strategies across Ethereum, Base, and Arbitrum... opportunities will appear here automatically.
        </p>
      </div>
    );
  }

  return null;
};

/* ----------------------------
   App context
   ----------------------------*/
const AppContext = createContext(null);
function useApp(){ return useContext(AppContext); }
const uid = (p = "id") => `${p}_${Math.random().toString(36).slice(2,9)}`;

/* ----------------------------
   Chat-first onboarding
   ----------------------------*/
function ChatPanel(){
  const { createMandateFromIntent, templates } = useApp();
  const [messages, setMessages] = useState([
    { id: uid('m'), from: 'agent', text: "Hi — I'm your Gearbox yield optimizer. Tell me what you'd like to do (try a template)." }
  ]);
  const [input, setInput] = useState('');

  const quickReplies = [
    {
      icon: "💰",
      label: "Stablecoins",
      description: "Earn with idle USDC/USDT",
      text: "Earn with my idle stablecoins"
    },
    {
      icon: "⚡",
      label: "Max Yields",
      description: "Leverage my ETH",
      text: "Leverage my ETH for maximum yields"
    },
    {
      icon: "🛡️",
      label: "Low Risk",
      description: "Conservative approach",
      text: "Show me low-risk opportunities"
    }
  ];

  function pushMessage(from, text){
    setMessages(m => [...m, { id: uid('m'), from, text }]);
  }

  function handleSend(text){
    if(!text) return;
    pushMessage('user', text);
    setInput('');

    // agent interprets intent (very simple NLP mock)
    setTimeout(()=>{
      // choose template best match
      const matched = templates.find(t => text.toLowerCase().includes(t.intentKeyword));
      if(matched){
        pushMessage('agent', `Got it — I will draft a ${matched.name} mandate. You can edit before signing.`);
        createMandateFromIntent(matched);
      } else {
        pushMessage('agent', `Thanks — I interpreted: "${text}". I'll draft a balanced mandate. Edit as needed.`);
        createMandateFromIntent(null, { freeText: text });
      }
    }, 700);
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm h-full flex flex-col">
      <div className="text-sm font-semibold mb-3">Assistant</div>

      {/* Input field at TOP for better discoverability */}
      <div className="mb-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e)=>setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend(input)}
            placeholder="Type your goal..."
            className="flex-1 p-2.5 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
          />
          <button
            onClick={()=>handleSend(input)}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-medium"
          >
            Send
          </button>
        </div>
      </div>

      {/* Visual template cards BELOW input as contextual suggestions */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {quickReplies.map(q => (
          <button
            key={q.label}
            onClick={() => { setInput(q.text); handleSend(q.text); }}
            className="flex flex-col items-center justify-center p-3 rounded-lg bg-gradient-to-br from-slate-50 to-white hover:from-indigo-50 hover:to-white border border-gray-200 hover:border-indigo-300 transition-all group"
          >
            <div className="text-2xl mb-1">{q.icon}</div>
            <div className="text-xs font-semibold text-gray-900 mb-0.5">{q.label}</div>
            <div className="text-[10px] text-gray-500 text-center leading-tight">{q.description}</div>
          </button>
        ))}
      </div>

      {/* Messages area with flex-1 to take remaining space */}
      <div className="flex-1 overflow-auto space-y-3">
        {messages.map(m => (
          <div key={m.id} className={`max-w-[85%] ${m.from==='agent' ? 'bg-slate-50 self-start rounded-lg p-3' : 'bg-indigo-600 text-white self-end rounded-lg p-3'}`}>
            <div className="text-sm">{m.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------
   SignMandate (inline preview + modal)
   ----------------------------*/
function SignMandatePanel({mandate}){
  const { signMandateWithWallet } = useApp();
  const [open,setOpen] = useState(false);
  const [loading,setLoading] = useState(false);

  if(!mandate) return null;

  const handleSign = async ()=>{
    setLoading(true);
    await signMandateWithWallet(mandate.id);
    setLoading(false);
    setOpen(false);
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold">Mandate preview</div>
          <div className="text-xs text-gray-500">Drafted from your conversation — edit or sign.</div>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>setOpen(true)} className="px-3 py-1 rounded bg-indigo-600 text-white text-sm">Sign</button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="text-xs text-gray-500">Asset</div><div className="font-medium">{mandate.asset}</div>
        <div className="text-xs text-gray-500">Min APY</div><div className="font-medium">{mandate.minAPY}%</div>
        <div className="text-xs text-gray-500">Max Leverage</div><div className="font-medium">{mandate.maxLeverage}x</div>
        <div className="text-xs text-gray-500">Risk</div><div className="font-medium">{mandate.risk}</div>
        <div className="text-xs text-gray-500">Max Position</div><div className="font-medium">${mandate.maxPosition}</div>
      </div>

      {/* modal simplified */}
      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg bg-white rounded-2xl p-6">
            <h3 className="text-lg font-semibold">Sign Mandate</h3>
            <p className="text-sm text-gray-600 mt-2">This signs an intent message — nothing will move without your approval.</p>

            <div className="mt-4 flex gap-2 justify-end">
              <button onClick={()=>setOpen(false)} className="px-3 py-2 rounded border">Cancel</button>
              <button onClick={handleSign} disabled={loading} className={`px-3 py-2 rounded ${loading ? 'bg-indigo-300' : 'bg-indigo-600 text-white'}`}>{loading ? 'Signing...' : 'Sign & Activate'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------------------
   Proposal / Tx components (lightweight)
   ----------------------------*/
function ProposalCard({p, onView}){
  return (
    <div className="rounded-lg border p-3 bg-white">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold">{p.title}</div>
          <div className="text-xs text-gray-500">{p.strategy} • {p.chain}</div>
        </div>
        <div className="text-right">
          <div className="font-semibold">{p.projAPY}%</div>
          <div className="text-xs text-gray-500">{p.leverage}x</div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="text-xs text-gray-500">Est. gas: ${p.estimatedGas}</div>
        <button onClick={()=>onView(p)} className="px-3 py-1 rounded bg-indigo-600 text-white text-sm">View</button>
      </div>
    </div>
  );
}

function ProposalDetailPanel({proposal}){
  const { approveProposal } = useApp();
  if(!proposal) return null;
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{proposal.title}</h3>
          <div className="text-xs text-gray-500">{proposal.chain} — {proposal.strategy}</div>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500">Projected APY</div>
          <div className="text-2xl font-semibold">{proposal.projAPY}%</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Field label="Investment">${proposal.deposit}</Field>
          <Field label="Borrow">${proposal.borrow} at {proposal.borrowRate}%</Field>
          <Field label="Health Factor">{proposal.healthFactor}x</Field>
        </div>
        <div>
          <div className="text-sm text-gray-500">Projected net (30d)</div>
          <div className="text-2xl font-semibold">${proposal.net30d}</div>

          <div className="mt-4 flex gap-2 justify-end">
            <button onClick={()=>approveProposal(proposal.id)} className="px-4 py-2 rounded bg-indigo-600 text-white">Approve & Sign</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TxProgressPanel({txId}){
  // Only show when transaction is active - no empty state needed
  if(!txId) return null;
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="text-sm font-semibold">Transaction Progress</div>
      <div className="mt-2 text-xs text-gray-500">Tx: <span className="font-mono">{txId}</span></div>
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between"><div>Open credit account</div><div className="text-xs text-green-600">✓</div></div>
        <div className="flex items-center justify-between"><div>Deposit collateral</div><div className="text-xs text-green-600">✓</div></div>
        <div className="flex items-center justify-between"><div>Swap & Stake</div><div className="text-xs text-yellow-600">Pending</div></div>
      </div>
    </div>
  );
}

/* ----------------------------
   App logic (limited opportunities, chat-driven mandates)
   ----------------------------*/
export default function FullFlowApp(){
  const templates = [
    { id: 'tmpl_stable', name: 'Stablecoin Yield (Conservative)', intentKeyword: 'stablecoins', asset: 'USDC', minAPY: 4.5, maxLeverage: 1.5, risk: 'Low', maxPosition: 5000 },
    { id: 'tmpl_eth_max', name: 'ETH Max Yield (Aggressive)', intentKeyword: 'eth', asset: 'wstETH', minAPY: 9, maxLeverage: 3, risk: 'High', maxPosition: 20000 },
    { id: 'tmpl_balanced', name: 'Balanced (Auto)', intentKeyword: 'balanced', asset: 'USDC', minAPY: 6.5, maxLeverage: 2, risk: 'Medium', maxPosition: 10000 },
  ];

  const [mandates, setMandates] = useState([]);
  const [activeMandate, setActiveMandate] = useState(null);
  const [proposals, setProposals] = useState([]); // limited to 3
  const [activeProposal, setActiveProposal] = useState(null);
  const [positions, setPositions] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [activeTx, setActiveTx] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  function pushNotification(n){ const note = { id: uid('n'), ...n }; setNotifications(s=>[note,...s]); setTimeout(()=>setNotifications(s=>s.filter(x=>x.id!==note.id)),7000); }

  function createMandateFromIntent(template=null, opts={}){
    const base = template ? template : { asset: 'USDC', minAPY:6.5, maxLeverage:2, risk:'Medium', maxPosition:10000 };
    const m = {
      id: uid('mandate'),
      ...base,
      ...opts.freeText && { note: opts.freeText },
      signed: false,
      createdAt: Date.now(),
      expiresAt: Date.now()+1000*60*60*24*30,
    };
    setMandates(s=>[m,...s]);
    setActiveMandate(m);
    pushNotification({ title: 'Mandate drafted', body: `${m.asset} — ${m.risk}` });

    // generate a small curated set of mock proposals once a mandate exists
    setTimeout(()=> generateMockProposals(m), 700);
  }

  async function signMandateWithWallet(id){
    await new Promise(r=>setTimeout(r,700));
    setMandates(s=>s.map(m=> m.id===id? {...m, signed:true, signedAt:Date.now() }: m));
    pushNotification({ title: 'Mandate signed', body: 'Agent will monitor and propose.' });
  }

  function generateMockProposals(mandate){
    // Show scanning state first
    setIsScanning(true);

    // produce up to 3 curated proposals tailored to the mandate (deterministic-ish)
    setTimeout(() => {
      const pool = [];
      if(mandate.asset.toLowerCase().includes('usdc')){
        pool.push({ id: uid('p'), title: 'USDC Yield Curve Pool', chain: 'Ethereum', strategy: 'Curve + Gearbox', projAPY: 6.8, collateralAPY: 2.5, deposit: Math.min(10000, mandate.maxPosition), borrow: 8000, leverage: 1.8, maxLeverage: mandate.maxLeverage, healthFactor:2.3, estimatedGas: 12, net30d: 42, borrowRate: 4.2 });
        pool.push({ id: uid('p'), title: 'Stable AAA Lending', chain: 'Base', strategy: 'Lending + leverage', projAPY: 7.1, collateralAPY: 2.1, deposit: Math.min(8000, mandate.maxPosition), borrow: 6000, leverage: 1.75, maxLeverage: mandate.maxLeverage, healthFactor:2.0, estimatedGas: 8, net30d: 38, borrowRate: 3.9 });
      }
      if(mandate.asset.toLowerCase().includes('wst') || mandate.asset.toLowerCase().includes('eth')){
        pool.push({ id: uid('p'), title: 'wstETH Lido Boost', chain: 'Ethereum', strategy: 'Lido + Curve', projAPY: 8.9, collateralAPY: 3.3, deposit: Math.min(10000, mandate.maxPosition), borrow: 15000, leverage: Math.min(2.8, mandate.maxLeverage), maxLeverage: mandate.maxLeverage, healthFactor:1.95, estimatedGas: 22, net30d: 65, borrowRate: 5.1 });
      }

      // ensure max 3 proposals and short-circuit duplicates
      const curated = pool.slice(0,3);
      setProposals(curated);
      setIsScanning(false);
      pushNotification({ title: 'Opportunities ready', body: `Found ${curated.length} matches for your mandate.` });
    }, 2000); // Simulate scanning delay
  }

  function openProposal(p){ setActiveProposal(p); }

  function approveProposal(id){
    const p = proposals.find(x=>x.id===id);
    if(!p) return;
    // simulate tx lifecycle
    const tx = uid('0xtx');
    setActiveTx(tx);
    setProposals([]); // clear feed after user commits (clean UX)
    pushNotification({ title: 'Proposal approved', body: `Tx ${tx} submitted` });

    setTimeout(()=>{
      const pos = { id: uid('pos'), title: p.title, value: p.deposit + p.net30d, healthFactor: p.healthFactor, txId: tx };
      setPositions(s=>[pos,...s]);
      pushNotification({ title: 'Position opened', body: `${p.title} is now active.` });
    }, 1400);

    setTimeout(()=> setActiveTx(null), 5000);
  }

  function closePosition(id){ setPositions(s=>s.filter(p=>p.id!==id)); pushNotification({ title: 'Position closed', body: 'Closed successfully.' }); }

  const value = useMemo(()=>({ templates, createMandateFromIntent, mandates, signMandateWithWallet, proposals, openProposal, approveProposal, positions, closePosition, notifications, pushNotification, isScanning, activeMandate }), [templates, mandates, proposals, positions, notifications, isScanning, activeMandate]);

  return (
    <AppContext.Provider value={value}>
      <div className="min-h-screen bg-slate-50 py-10">
        <div className="max-w-7xl mx-auto px-4">
          {/* Collapsible sidebar toggle */}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="mb-4 px-3 py-2 rounded-lg bg-white shadow-sm hover:shadow text-sm font-medium flex items-center gap-2"
          >
            {isSidebarCollapsed ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Show Assistant
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Hide Assistant
              </>
            )}
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Chat + Mandate - Collapsible */}
            {!isSidebarCollapsed && (
              <div className="lg:col-span-3 space-y-4">
                <div className="h-96"><ChatPanel /></div>
                {activeMandate && <SignMandatePanel mandate={activeMandate} />}
              </div>
            )}

            {/* Main: Opportunities + Detail - Expands when sidebar collapsed */}
            <div className={`space-y-4 ${isSidebarCollapsed ? 'lg:col-span-12' : 'lg:col-span-9'}`}>
            <div className="rounded-2xl p-4 bg-white shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Strategies for You</h3>
                  <p className="text-xs text-gray-500">
                    {proposals.length > 0
                      ? `${proposals.length} high-yield opportunities ready to review`
                      : activeMandate
                        ? 'Finding the best matches for your mandate...'
                        : 'Create a mandate to start finding opportunities'}
                  </p>
                </div>
                {proposals.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <div className="text-xs text-gray-500">Last scan: just now</div>
                  </div>
                )}
              </div>

              {proposals.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {proposals.map(p => <ProposalCard key={p.id} p={p} onView={openProposal} />)}
                </div>
              ) : (
                <OpportunityEmptyState
                  hasMandate={!!activeMandate}
                  isScanning={isScanning}
                  onCreateMandate={() => {
                    // Focus on the input field in chat
                    pushNotification({ title: 'Getting started', body: 'Use the assistant to describe your investment goals.' });
                  }}
                />
              )}
            </div>

            {activeProposal && <ProposalDetailPanel proposal={activeProposal} />}

            {/* Transaction Progress and Positions - only show when active */}
            <div className="space-y-4">
              {activeTx && <TxProgressPanel txId={activeTx} />}

              {positions.length > 0 && (
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold">Active Positions</div>
                    <div className="text-xs text-gray-500">{positions.length} position{positions.length !== 1 ? 's' : ''}</div>
                  </div>
                  <div className="space-y-3">
                    {positions.map(p => (
                      <div key={p.id} className="flex items-center justify-between border rounded-lg p-3 hover:border-gray-300 transition-colors">
                        <div>
                          <div className="text-sm font-semibold">{p.title}</div>
                          <div className="text-xs text-gray-500">Value: ${p.value.toLocaleString()} • Health: {p.healthFactor}x</div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={()=>closePosition(p.id)} className="px-3 py-1.5 rounded-lg border border-gray-200 hover:border-red-300 hover:bg-red-50 text-sm transition-colors">Close</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        </div>

        {/* Notifications */}
        <div className="fixed right-6 bottom-6 w-96 space-y-3 z-50">
          {/** Simple notifications list */}
          {value.notifications && value.notifications.map(n => (
            <div key={n.id} className="rounded-lg border bg-white p-3 shadow">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-semibold">{n.title}</div>
                  <div className="text-xs text-gray-600 mt-1">{n.body}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppContext.Provider>
  );
}
