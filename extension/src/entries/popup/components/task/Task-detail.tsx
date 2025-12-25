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
    const { request } = useRequestContext();
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
        <div className="w-full h-full flex flex-col bg-[#F5F5F5]">
            {/* Header with back button and progress */}
            <div className="w-full bg-[#fff] px-[24px] pt-[16px] pb-[16px] flex items-center justify-between border-b border-[rgba(0,0,0,0.1)]">
                <div className="flex items-center">
                    <button
                        onClick={() => navigate('/task-home', { replace: true })}
                        className="mr-[16px] cursor-pointer"
                    >
                        <ArrowLeft className="w-[24px] text-[#fff] h-[24px]" />
                    </button>
                    <span className="font-[500] text-[21px] leading-[25px]">Task Details</span>
                </div>
                <div className="font-[500] text-[19px] leading-[22px] text-[rgba(0,0,0,0.6)]">
                    {currentIndex + 1} / {totalSubTasks}
                </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-[4px] bg-[rgba(0,0,0,0.1)]">
                <div
                    className="h-full bg-[#000] transition-all duration-300"
                    style={{ width: `${((currentIndex + 1) / totalSubTasks) * 100}%` }}
                />
            </div>

            {/* Task content */}
            <div ref={scrollContainerRef} className="flex-1 overflow-auto px-[24px] py-[24px]">
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
                <div className="w-full px-[24px] pb-[16px] pt-[8px] bg-[#fff] border-t border-[rgba(0,0,0,0.1)]">
                    <div className="text-center font-[500] text-[17px] leading-[20px] text-[rgba(0,0,0,0.6)]">
                        {totalSubTasks - currentIndex - 1} more {totalSubTasks - currentIndex - 1 === 1 ? 'task' : 'tasks'} remaining
                    </div>
                </div>
            )}

            {/* Loading overlay */}
            {/* {signing && (
                <div className="w-full h-full bg-[#000]/[70%] absolute left-0 top-0 flex items-center justify-center">
                    <div className="flex flex-col items-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
                        <div className="text-[#fff] text-[32px] font-[500]">Signing...</div>
                    </div>
                </div>
            )} */}
        </div>
    );
});
