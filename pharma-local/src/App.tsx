import { BillingTerminal } from "@/components/billing/BillingTerminal";

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b px-4 py-2 flex items-center justify-between">
        <h1 className="text-xl font-bold">PharmaLocal — Billing Terminal</h1>
      </header>
      <main className="h-[calc(100vh-3rem)]">
        <BillingTerminal />
      </main>
    </div>
  );
}

export default App;
