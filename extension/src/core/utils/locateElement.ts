/**
 * 处理定位元素点击事件
 * 当用户点击带有 data-key 属性的数据项时调用
 *
 * @param event - 点击事件对象
 *
 * 功能：
 * 1. 从点击元素获取 data-key 属性
 * 2. 获取元素的显示内容作为 value
 * 3. 使用 Messager 发送定位消息到业务系统页面
 */
import { MessagerManager, SealxTopic, MessageChannel } from 'sealx-message';
import type { LocateElementMessage } from 'sealx-message';

export const handleLocateElement = async (event: React.MouseEvent<HTMLElement>): Promise<void> => {
    // 阻止默认行为（防止打开新窗口）
    event.preventDefault();
    event.stopPropagation();

    const target = event.currentTarget;
    const dataKey = target.getAttribute('data-key');

    // 如果没有 data-key 属性，则不处理
    if (!dataKey) {
        console.log('[LocateElement] No data-key attribute found');
        return;
    }

    // 获取显示内容作为 value
    const value = target.textContent?.trim() || '';

    // 将数组下标如 #1, #2 或 item1, item2 替换为 [*]，便于业务系统匹配
    // 匹配 #数字 或 item数字 格式
    const normalizedKey = dataKey.replace(/(#\d+|item\d+)/g, '[*]');

    console.log('[LocateElement] Locating element:', { key: normalizedKey, value, originalKey: dataKey });

    try {
        // 使用 Messager 发送定位消息到 Content Script
        const messager = MessagerManager.getMessager();

        const payload: LocateElementMessage = {
            key: normalizedKey,
            value: value
        };

        // 发送消息到 INPAGE（业务系统页面）
        messager.send(payload, SealxTopic.LOCATE_ELEMENT, MessageChannel.INPAGE);

        console.log('[LocateElement] Message sent via Messager');
    } catch (error) {
        console.warn('[LocateElement] Failed to send message:', error);
    }
};
