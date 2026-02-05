interface HomeLayoutProps {
  children: React.ReactNode;
}

export function HomeLayout({ children }: HomeLayoutProps) {
  return (
    <div className="h-screen w-full flex flex-col bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-50 font-sans overflow-hidden">
      <main className="flex-1 flex flex-col md:flex-row h-full overflow-hidden">
        {children}
      </main>
    </div>
  );
}
