interface ProposalBuilderProps {
    project: any;
    tasks: any[];
    grandTotals: {
        hours: number;
        cost: number;
    };
}
export default function ProposalBuilder({ project, tasks, grandTotals }: ProposalBuilderProps): import("react/jsx-runtime").JSX.Element;
export {};
