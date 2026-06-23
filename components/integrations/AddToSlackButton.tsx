"use client";

/* eslint-disable @next/next/no-img-element */

type AddToSlackButtonProps = {
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  label?: string;
};

const SLACK_BADGE_SRC = "https://platform.slack-edge.com/img/add_to_slack.png";
const SLACK_BADGE_SRC_SET =
  "https://platform.slack-edge.com/img/add_to_slack.png 1x, https://platform.slack-edge.com/img/add_to_slack@2x.png 2x";

function Badge({ label }: { label: string }) {
  return (
    <img
      alt={label}
      height={40}
      width={139}
      src={SLACK_BADGE_SRC}
      srcSet={SLACK_BADGE_SRC_SET}
      className="h-10 w-[139px]"
    />
  );
}

export default function AddToSlackButton({
  href,
  onClick,
  disabled = false,
  className = "",
  label = "Add to Slack",
}: AddToSlackButtonProps) {
  const sharedClassName = `inline-flex h-10 w-[139px] shrink-0 items-center justify-center rounded-[4px] transition-opacity ${
    disabled ? "cursor-not-allowed opacity-50" : "hover:opacity-90"
  } ${className}`;

  if (href) {
    return (
      <a href={href} onClick={onClick} aria-label={label} className={sharedClassName}>
        <Badge label={label} />
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={sharedClassName}
    >
      <Badge label={label} />
    </button>
  );
}
