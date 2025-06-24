
import { useState, useEffect, useCallback } from 'react';
import type { PlanTemplate, PlanStage } from '../types.ts';

const PLAN_TEMPLATES_LOCALSTORAGE_KEY = "autologos_plan_templates_v2";

const BUILT_IN_PLAN_TEMPLATES: PlanTemplate[] = [
    {
        name: "Content Generation (Paragraph & Improve)",
        stages: [
            { id: 'b_s1', format: 'paragraph', length: 'much_longer', complexity: 'maintain', stageIterations: 2, outputParagraphShowHeadings: true, outputParagraphMaxHeadingDepth: 2, outputParagraphNumberedHeadings: false },
            { id: 'b_s2', format: 'paragraph', length: 'same', complexity: 'enrich', stageIterations: 1, outputParagraphShowHeadings: true, outputParagraphMaxHeadingDepth: 3, outputParagraphNumberedHeadings: true },
        ]
    },
    {
        name: "Summarize (Key Points & Outline)",
        stages: [
            { id: 'b_s3', format: 'key_points', length: 'shorter', complexity: 'simplify', stageIterations: 1 },
            { id: 'b_s4', format: 'outline', length: 'same', complexity: 'maintain', stageIterations: 1 },
        ]
    },
    {
        name: "Structure as JSON",
        stages: [
            { id: 'b_s10', format: 'json', length: 'same', complexity: 'maintain', stageIterations: 1 },
            { id: 'b_s11', format: 'json', length: 'same', complexity: 'maintain', stageIterations: 1 },
        ]
    },
    {
        name: "Auto-Analysis & Refine",
        stages: [
            { id: 'b_s20', format: 'auto', length: 'auto', complexity: 'auto', stageIterations: 1 },
            { id: 'b_s21', format: 'auto', length: 'same', complexity: 'enrich', stageIterations: 1 },
        ]
    }
];

export const usePlanTemplates = () => {
    const [savedPlanTemplates, setSavedPlanTemplates] = useState<PlanTemplate[]>(BUILT_IN_PLAN_TEMPLATES);
    const [statusMessage, setStatusMessage] = useState<string>("");

    const loadUserTemplates = useCallback(() => {
        try {
            const storedTemplates = localStorage.getItem(PLAN_TEMPLATES_LOCALSTORAGE_KEY);
            if (storedTemplates) {
                const userTemplates = JSON.parse(storedTemplates) as PlanTemplate[];
                const uniqueUserTemplates = userTemplates.filter(ut => !BUILT_IN_PLAN_TEMPLATES.some(bt => bt.name === ut.name));
                setSavedPlanTemplates([...BUILT_IN_PLAN_TEMPLATES, ...uniqueUserTemplates]);
            } else {
                setSavedPlanTemplates([...BUILT_IN_PLAN_TEMPLATES]); // Only built-in if nothing stored
            }
        } catch (error) {
            console.error("Error loading plan templates from localStorage:", error);
            setSavedPlanTemplates([...BUILT_IN_PLAN_TEMPLATES]);
            setStatusMessage("Error loading saved plan templates.");
        }
    }, []);
    
    useEffect(() => {
        loadUserTemplates();
    }, [loadUserTemplates]);


    const persistUserTemplates = useCallback((templatesToPersist: PlanTemplate[]) => {
        try {
            const userOnlyTemplates = templatesToPersist.filter(t => !BUILT_IN_PLAN_TEMPLATES.some(bt => bt.name === t.name));
            localStorage.setItem(PLAN_TEMPLATES_LOCALSTORAGE_KEY, JSON.stringify(userOnlyTemplates));
        } catch (error) {
            console.error("Error saving plan templates to localStorage:", error);
            setStatusMessage("Error saving plan template.");
        }
    }, []);

    const handleSavePlanAsTemplate = useCallback((templateName: string, stages: PlanStage[]) => {
        if (BUILT_IN_PLAN_TEMPLATES.some(bt => bt.name.toLowerCase() === templateName.toLowerCase())) {
            setStatusMessage(`Cannot overwrite a built-in template. Please choose a different name for "${templateName}".`);
            alert(`Cannot overwrite a built-in template. Please choose a different name for "${templateName}".`);
            return;
        }
        const existingTemplateIndex = savedPlanTemplates.findIndex(t => t.name === templateName && !BUILT_IN_PLAN_TEMPLATES.some(bt => bt.name === t.name));
        
        if (existingTemplateIndex !== -1) {
             if (!window.confirm(`A user template named "${templateName}" already exists. Overwrite it?`)) {
                setStatusMessage(`Save operation for template "${templateName}" cancelled.`);
                return;
            }
        }
        
        const newTemplate: PlanTemplate = { name: templateName, stages };
        let updatedTemplates;
        if (existingTemplateIndex !== -1) { // Only true if it's an existing USER template
            updatedTemplates = savedPlanTemplates.map(t => t.name === templateName ? newTemplate : t);
        } else {
            // Add new or replace if it was a built-in name attempt that got past the first check (should not happen)
             const filteredTemplates = savedPlanTemplates.filter(t => t.name !== templateName);
            updatedTemplates = [...filteredTemplates, newTemplate];
        }
        setSavedPlanTemplates(updatedTemplates);
        persistUserTemplates(updatedTemplates);
        setStatusMessage(`Plan template "${templateName}" saved.`);
    }, [savedPlanTemplates, persistUserTemplates]);

    const handleDeletePlanTemplate = useCallback((templateName: string) => {
        if (BUILT_IN_PLAN_TEMPLATES.some(bt => bt.name === templateName)) {
            setStatusMessage("Cannot delete built-in plan templates.");
            alert("Cannot delete built-in plan templates.");
            return;
        }
        const updatedTemplates = savedPlanTemplates.filter(t => t.name !== templateName);
        setSavedPlanTemplates(updatedTemplates);
        persistUserTemplates(updatedTemplates);
        setStatusMessage(`Plan template "${templateName}" deleted.`);
    }, [savedPlanTemplates, persistUserTemplates]);

    const overwriteUserTemplates = useCallback((newUserTemplates: PlanTemplate[]) => {
        const uniqueUserTemplates = newUserTemplates.filter(ut => !BUILT_IN_PLAN_TEMPLATES.some(bt => bt.name === ut.name));
        const finalTemplates = [...BUILT_IN_PLAN_TEMPLATES, ...uniqueUserTemplates];
        setSavedPlanTemplates(finalTemplates);
        persistUserTemplates(finalTemplates); // This will persist only the user ones from the combined list
        setStatusMessage("User plan templates restored from project file.");
    }, [persistUserTemplates]);

    return {
        savedPlanTemplates,
        handleSavePlanAsTemplate,
        handleDeletePlanTemplate,
        planTemplateStatusMessage: statusMessage, 
        clearPlanTemplateStatusMessage: () => setStatusMessage(""),
        loadUserTemplates,
        overwriteUserTemplates,
    };
};