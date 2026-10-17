/** Keep the source dialog's confirm/cancel order, including keyboard navigation. */
export function renderDialogFooter(_, { OkBtn, CancelBtn }) {
  return (
    <div className="dialog-footer">
      <OkBtn />
      <CancelBtn />
    </div>
  );
}
