"use client";

import React, { useState, useEffect } from "react";
import Joyride, { CallBackProps, STATUS, Step } from "react-joyride";
import { usePathname } from "next/navigation";

const TOUR_STEPS: Record<string, Step[]> = {
    "/global": [
        {
            target: ".tour-search",
            content: "Type the name of any RNA (e.g. GcvB) here to focus the interaction map on it.",
            disableBeacon: true,
        },
        {
            target: ".tour-filters",
            content: "Use these sliders to filter out low-confidence noise by adjusting minimum chimeric reads and Odds Ratio thresholds.",
        },
        {
            target: ".tour-data",
            content: "We've loaded a demo dataset. You can switch to other presets or upload your own TRIC-seq interaction and annotation CSVs here.",
        },
        {
            target: ".tour-scatter",
            content: "This shows all interacting partners plotted across the genome. Click any circle to select a precise target for further comparison.",
            placement: "left",
        },
        {
            target: ".tour-legend",
            content: "These legends color-code the biological feature types of the partners, so you can quickly identify trends like a prevalence of CDS (orange) target interactions.",
        },
        {
            target: ".tour-table-cols",
            content: "The table below lists precise interaction metrics. 'i_o' represents the raw chimera read count, and Odds Ratio (O_f) measures enrichment significance. High O_f with strong counts implies high-confidence binding.",
            placement: "top",
        }
    ],
};

export function InteractiveTour() {
    const pathname = usePathname();
    const [run, setRun] = useState(false);
    const [steps, setSteps] = useState<Step[]>([]);
    const [hasMounted, setHasMounted] = useState(false);

    useEffect(() => {
        setHasMounted(true);
    }, []);

    // Check if we have a tour for the current route
    useEffect(() => {
        if (!pathname) return;
        const routeSteps = TOUR_STEPS[pathname];

        // Only auto-run if we haven't seen it (using localStorage) and steps exist
        if (routeSteps && routeSteps.length > 0) {
            setSteps(routeSteps);
            const hasSeenTour = localStorage.getItem(`tour-seen-${pathname}`);
            if (!hasSeenTour) {
                // Small delay to let components render
                const timer = setTimeout(() => setRun(true), 1500);
                return () => clearTimeout(timer);
            }
        } else {
            setRun(false);
        }
    }, [pathname]);

    const handleJoyrideCallback = (data: CallBackProps) => {
        const { status } = data;
        const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

        if (finishedStatuses.includes(status)) {
            setRun(false);
            localStorage.setItem(`tour-seen-${pathname}`, "true");
        }
    };

    // Provide a global function on window to manually restart the tour
    useEffect(() => {
        if (typeof window !== "undefined") {
            (window as any).startTour = () => {
                if (TOUR_STEPS[pathname as string]) {
                    setRun(true);
                }
            };
        }
    }, [pathname]);

    if (!hasMounted) return null;

    return (
        <Joyride
            callback={handleJoyrideCallback}
            continuous
            hideCloseButton
            run={run}
            scrollToFirstStep
            showProgress
            showSkipButton
            steps={steps}
            styles={{
                options: {
                    zIndex: 10000,
                    primaryColor: "#0f172a",
                    textColor: "#334155",
                    backgroundColor: "#ffffff",
                    arrowColor: "#ffffff",
                    overlayColor: "rgba(0, 0, 0, 0.5)",
                },
                tooltipContainer: {
                    textAlign: "left"
                },
                buttonNext: {
                    backgroundColor: "#0ea5e9",
                    borderRadius: 6,
                    color: "#ffffff",
                },
                buttonBack: {
                    color: "#64748b",
                },
                buttonSkip: {
                    color: "#94a3b8",
                }
            }}
        />
    );
}
