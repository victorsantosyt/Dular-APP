import "@shopify/flash-list";

declare module "@shopify/flash-list" {
  interface FlashListProps<T> {
    /**
     * Estimated height/width for items to improve virtualization performance.
     */
    estimatedItemSize?: number;
  }
}
