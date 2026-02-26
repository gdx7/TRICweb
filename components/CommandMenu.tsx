"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Search, Map, HelpCircle, FileText } from "lucide-react";

export function CommandMenu() {
    const [open, setOpen] = React.useState(false);
    const router = useRouter();

    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };
        document.addEventListener("keydown", down);
        return () => document.removeEventListener("keydown", down);
    }, []);

    const runCommand = React.useCallback(
        (command: () => void) => {
            setOpen(false);
            command();
        },
        []
    );

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
                <Search className="h-4 w-4" />
                <span className="hidden sm:inline-block">Search commands...</span>
                <kbd className="pointer-events-none ml-2 inline-flex h-5 select-none items-center gap-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 px-1.5 font-mono text-[10px] font-medium text-slate-500 dark:text-slate-400">
                    <span className="text-xs">⌘</span>K
                </kbd>
            </button>

            {open && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm" onClick={() => setOpen(false)}>
                    <div
                        className="fixed left-[50%] top-[20%] z-50 w-full max-w-lg translate-x-[-50%] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-0 shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Command
                            className="flex h-full w-full flex-col overflow-hidden bg-transparent"
                            onKeyDown={(e) => {
                                if (e.key === "Escape") setOpen(false);
                            }}
                        >
                            <div className="flex items-center border-b border-slate-200 dark:border-slate-800 px-3">
                                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50 dark:text-slate-400" />
                                <Command.Input
                                    placeholder="Type a command or search..."
                                    className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-100"
                                    autoFocus
                                />
                            </div>
                            <Command.List className="max-h-[300px] overflow-y-auto overflow-x-hidden p-2">
                                <Command.Empty className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                                    No results found.
                                </Command.Empty>
                                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 px-2 py-1.5">
                                    <span className="block mb-2 mt-1 px-1">Navigation</span>
                                    <Command.Item
                                        onSelect={() => runCommand(() => router.push("/global"))}
                                        className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2.5 text-sm outline-none data-[selected=true]:bg-slate-100 dark:data-[selected=true]:bg-slate-800 data-[selected=true]:text-slate-900 dark:data-[selected=true]:text-slate-100 text-slate-700 dark:text-slate-300 transition-colors"
                                    >
                                        <Map className="mr-2 h-4 w-4" />
                                        globalMAP
                                    </Command.Item>
                                    <Command.Item
                                        onSelect={() => runCommand(() => router.push("/csmap"))}
                                        className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2.5 text-sm outline-none data-[selected=true]:bg-slate-100 dark:data-[selected=true]:bg-slate-800 data-[selected=true]:text-slate-900 dark:data-[selected=true]:text-slate-100 text-slate-700 dark:text-slate-300 transition-colors"
                                    >
                                        <Map className="mr-2 h-4 w-4" />
                                        csMAP
                                    </Command.Item>
                                    <Command.Item
                                        onSelect={() => runCommand(() => router.push("/pairmap"))}
                                        className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2.5 text-sm outline-none data-[selected=true]:bg-slate-100 dark:data-[selected=true]:bg-slate-800 data-[selected=true]:text-slate-900 dark:data-[selected=true]:text-slate-100 text-slate-700 dark:text-slate-300 transition-colors"
                                    >
                                        <Map className="mr-2 h-4 w-4" />
                                        pairMAP
                                    </Command.Item>
                                    <Command.Item
                                        onSelect={() => runCommand(() => router.push("/foldmap"))}
                                        className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2.5 text-sm outline-none data-[selected=true]:bg-slate-100 dark:data-[selected=true]:bg-slate-800 data-[selected=true]:text-slate-900 dark:data-[selected=true]:text-slate-100 text-slate-700 dark:text-slate-300 transition-colors"
                                    >
                                        <Map className="mr-2 h-4 w-4" />
                                        foldMAP
                                    </Command.Item>
                                </div>
                                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 px-2 pt-3 pb-1.5 border-t border-slate-100 dark:border-slate-800">
                                    <span className="block mb-2 mt-1 px-1">Help</span>
                                    <Command.Item
                                        onSelect={() => runCommand(() => router.push("/help"))}
                                        className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2.5 text-sm outline-none data-[selected=true]:bg-slate-100 dark:data-[selected=true]:bg-slate-800 data-[selected=true]:text-slate-900 dark:data-[selected=true]:text-slate-100 text-slate-700 dark:text-slate-300 transition-colors"
                                    >
                                        <HelpCircle className="mr-2 h-4 w-4" />
                                        Documentation / Help
                                    </Command.Item>
                                </div>
                            </Command.List>
                        </Command>
                    </div>
                </div>
            )}
        </>
    );
}
