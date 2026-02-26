"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils"; // Assuming you have a standard cn utility

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
    React.ElementRef<typeof TooltipPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
    <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
            "z-50 overflow-hidden rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-950 dark:text-slate-50 shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
            className
        )}
        {...props}
    />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

interface InfoTooltipProps {
    content: React.ReactNode;
    children?: React.ReactNode;
    side?: "top" | "right" | "bottom" | "left";
    className?: string;
    iconClassName?: string;
}

export function InfoTooltip({ content, children, side = "top", className, iconClassName }: InfoTooltipProps) {
    return (
        <TooltipProvider delayDuration={200}>
            <Tooltip>
                <TooltipTrigger asChild>
                    {children ? (
                        children
                    ) : (
                        <button
                            type="button"
                            className={cn("inline-flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 opacity-50 hover:opacity-100 transition-opacity", className)}
                            aria-label="More information"
                        >
                            <Info className={cn("h-4 w-4 text-slate-500 dark:text-slate-400", iconClassName)} />
                        </button>
                    )}
                </TooltipTrigger>
                <TooltipContent side={side} className="max-w-[280px] break-words">
                    {content}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
