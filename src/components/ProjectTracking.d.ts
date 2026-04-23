import 'gantt-task-react/dist/index.css';
interface ProjectTrackingProps {
    project: any;
    tasks: any[];
    roles: any[];
    onProjectUpdate: (updatedProject: any) => void;
    isSidebarOpen?: boolean;
}
export default function ProjectTracking({ project, tasks, roles, onProjectUpdate, isSidebarOpen }: ProjectTrackingProps): import("react/jsx-runtime").JSX.Element;
export {};
