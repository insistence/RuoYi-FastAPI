import { Tag } from "antd";
import OAuthTag from "./OAuthTag";
export default function TagSummary({
  values = [],
  limit = 3,
  label = (value) => value,
  empty = "",
  effect,
}) {
  return (
    <div className="oauth-tag-summary">
      {(values || []).slice(0, limit).map((value) =>
        effect === "plain" ? (
          <OAuthTag size="small" effect="plain" key={value}>
            {label(value)}
          </OAuthTag>
        ) : (
          <Tag className="dict-tag" color="processing" key={value}>
            {label(value)}
          </Tag>
        ),
      )}
      {values?.length > limit && <span>+{values.length - limit}</span>}
      {!values?.length && <span>{empty}</span>}
    </div>
  );
}
