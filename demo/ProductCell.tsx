/**
 * A product in a table: its thumbnail and title, the variant's name as a
 * badge beneath (none for the default variant), as the admin's Inventory.
 */
export const ProductCell = ({
  image,
  title,
  variantTitle,
  href,
}: {
  image: string | null;
  title: string;
  variantTitle?: string;
  href?: string;
}) => (
  <s-stack direction="inline" gap="small-200" alignItems="center">
    {image ? (
      <s-thumbnail src={image} alt={title} size="small-200" />
    ) : (
      <s-thumbnail src="" alt="" size="small-200" />
    )}
    <s-stack gap="small-500">
      {href ? (
        <s-link href={href}>
          <s-text type="strong">{title}</s-text>
        </s-link>
      ) : (
        <s-text type="strong">{title}</s-text>
      )}
      {variantTitle && variantTitle !== "Default Title" && <s-badge>{variantTitle}</s-badge>}
    </s-stack>
  </s-stack>
);
