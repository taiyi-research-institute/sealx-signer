import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { SignContent } from 'sealx-core';
import { SignTaskRender } from './task-render.js';
import { useRequestContext } from '@src/hooks/useRequestContextHook';
import messager from '@src/core/messager';
import { SealxTopic } from 'sealx-message';
import { MessageChannel } from 'sealx-message';
import ArrowLeft from '@assets/svg/arrow-left.svg?react';

interface SubTask {
    taskId: string;
    signContent: SignContent;
}

interface TaskDetailState {
    mainTaskId: string;
    taskType: string;
    command: string;
    validUntilTime: number;
    subTasks: SubTask[];
    preViewUrl?: string;
    extenals?: Record<string, unknown>;
}

export const TaskDetail = memo(() => {
    const location = useLocation();
    const navigate = useNavigate();
    useRequestContext();
    const [signing, setSigning] = useState(false);

    // Get task data from navigation state
    const taskData = location.state as TaskDetailState | null;

    // Track current subtask index
    const [currentIndex, setCurrentIndex] = useState(0);

    // Store signatures for all completed subtasks
    const [signatures, setSignatures] = useState<Array<{ taskId: string; signature: string }>>([]);

    // Ref for the scrollable task content container
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Navigate back if no task data
    useEffect(() => {
        if (!taskData || !taskData.subTasks || taskData.subTasks.length === 0) {
            navigate('/', { replace: true });
        }
    }, [taskData, navigate]);

    // Preserve scroll position when subtask changes
    useEffect(() => {
        // Store current scroll position before subtask change
        const scrollContainer = scrollContainerRef.current;
        if (scrollContainer) {
            // Scroll to top when moving to next subtask to ensure consistent starting position
            scrollContainer.scrollTop = 0;
        }
    }, [currentIndex]);

    const currentSubTask = useMemo(() => {
        if (!taskData?.subTasks) return null;
        return taskData.subTasks[currentIndex];
    }, [taskData, currentIndex]);

    const totalSubTasks = taskData?.subTasks?.length || 0;
    const isLastSubTask = currentIndex === totalSubTasks - 1;

    // Handle signing a subtask
    const handleSign = useCallback(
        async (subTaskId: string, signature: string | { taskId: string; signature: string }[] | null) => {
            if (!taskData) return;

            // If rejected (empty signature), reject entire task
            if (signature === '' || signature === null) {
                messager.send(
                    {
                        taskId: taskData.mainTaskId,
                        signatures: null,
                        rejected: true,
                    },
                    SealxTopic.SIGN_RESPONSE,
                    MessageChannel.INPAGE
                );
                navigate('/task-home', { replace: true });
                return;
            }

            // Store the signature
            const newSignature = {
                taskId: subTaskId,
                signature: typeof signature === 'string' ? signature : signature[0]?.signature || '',
            };
            const updatedSignatures = [...signatures, newSignature];
            setSignatures(updatedSignatures);

            // If this was the last subtask, submit all signatures
            if (isLastSubTask) {
                navigate('/task-home', {
                    replace: true, state: {
                        result: {
                            taskId: taskData.mainTaskId,
                            signatures: updatedSignatures,
                            signCount: updatedSignatures.length,
                        }
                    }
                });
            } else {
                // Move to next subtask
                setCurrentIndex((prev) => prev + 1);
                setSigning(false)
            }
        },
        [taskData, signatures, isLastSubTask, navigate]
    );

    if (!taskData || !currentSubTask) {
        return null;
    }

    return (
        <div className="w-full h-full flex flex-col bg-[var(--sx-bg)]">
            {/* Header with back button and progress */}
            <div className="w-full bg-[var(--sx-surface)] px-[1.25rem] pt-[0.875rem] pb-[0.875rem] flex items-center justify-between border-b border-[var(--sx-border)]">
                <div className="flex items-center">
                    <button
                        onClick={() => navigate('/task-home', { replace: true })}
                        className="mr-[0.75rem] cursor-pointer rounded-[8px] border border-[var(--sx-border)] bg-[var(--sx-surface-soft)] w-[34px] h-[34px] flex items-center justify-center"
                    >
                        <ArrowLeft className="w-[18px] text-[var(--sx-text)] h-[18px]" />
                    </button>
                    <span className="font-[800] text-[1.125rem] leading-[1.35] text-[var(--sx-text)]">Task Details</span>
                </div>
                <div className="font-[800] text-[0.875rem] leading-[1.35] text-[var(--sx-muted)]">
                    {currentIndex + 1} / {totalSubTasks}
                </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-[4px] bg-[rgba(16,24,32,0.08)]">
                <div
                    className="h-full bg-[var(--sx-brand)] transition-all duration-300 ease-out"
                    style={{ width: `${((currentIndex + 1) / totalSubTasks) * 100}%` }}
                />
            </div>

            {/* Task content */}
            <div ref={scrollContainerRef} className="flex-1 overflow-auto px-[1.5rem] py-[1.5rem]">
                {currentSubTask && (
                    <SignTaskRender
                        signContent={currentSubTask.signContent}
                        command={taskData.command}
                        taskId={currentSubTask.taskId}
                        taskType={taskData.taskType}
                        validUntilTime={taskData.validUntilTime}
                        signing={signing}
                        setSigning={setSigning}
                        onSign={handleSign}
                        confirmText={isLastSubTask ? 'Sign To Approve' : 'Next'}
                        extenals={taskData.extenals}
                    />
                )}
            </div>

            {/* Info about remaining tasks */}
            {!isLastSubTask && (
                <div className="w-full px-[1.25rem] pb-[0.875rem] pt-[0.75rem] bg-[var(--sx-surface)] border-t border-[var(--sx-border)]">
                    <div className="text-center font-[750] text-[0.875rem] leading-[1.35] text-[var(--sx-muted)]">
                        {totalSubTasks - currentIndex - 1} more {totalSubTasks - currentIndex - 1 === 1 ? 'task' : 'tasks'} remaining
                    </div>
                </div>
            )}

            {/* Signing overlay */}
            {signing && (
                <div className="absolute inset-0 bg-[#101820]/82 flex items-center justify-center z-50">
                    <div className="flex flex-col items-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-[3px] border-white/30 border-t-white mb-4"></div>
                        <div className="text-white text-[1rem] font-[800]">Signing...</div>
                    </div>
                </div>
            )}
        </div>
    );
});
