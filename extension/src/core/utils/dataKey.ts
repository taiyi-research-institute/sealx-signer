/**
 * 生成用于元素定位的 data-key 属性值
 *
 * @param key - 当前字段的名称
 * @param parentKeys - 父级字段名称的数组（用于嵌套路径）
 * @returns 完整的 data-key 属性值，如 "message.orderId"
 *
 * @example
 * generateDataKey('orderId', []) // => 'orderId'
 * generateDataKey('orderId', ['message']) // => 'message.orderId'
 * generateDataKey('from', ['message']) // => 'message.from'
 */
export const generateDataKey = (key: string, parentKeys: string[] = []): string => {
    if (parentKeys.length === 0) {
        return key;
    }
    return [...parentKeys, key].join('.');
};

/**
 * 从对象中提取所有叶子节点的路径和值
 * 用于生成所有可定位的数据项
 *
 * @param obj - 要遍历的对象
 * @param parentKeys - 父级路径（用于递归）
 * @returns 包含 key 路径和值的数组
 *
 * @example
 * const data = { message: { orderId: '123', from: '0xABC' } };
 * extractLeafNodes(data);
 * // => [
 * //   { key: 'message.orderId', value: '123' },
 * //   { key: 'message.from', value: '0xABC' }
 * // ]
 */
export interface LeafNode {
    key: string;
    value: unknown;
}

export const extractLeafNodes = (
    obj: Record<string, unknown>,
    parentKeys: string[] = []
): LeafNode[] => {
    const results: LeafNode[] = [];

    for (const [key, value] of Object.entries(obj)) {
        const currentKey = generateDataKey(key, parentKeys);

        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            // 递归处理嵌套对象
            results.push(...extractLeafNodes(value as Record<string, unknown>, [...parentKeys, key]));
        } else {
            // 叶子节点
            results.push({
                key: currentKey,
                value,
            });
        }
    }

    return results;
};
