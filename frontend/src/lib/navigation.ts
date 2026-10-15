export type NavLink = {
  label: string;
  href: string;
  /** Sprint 01 ships Home and Daily Challenge as real routes; the rest are labeled coming-soon. */
  comingSoon?: boolean;
};

export const primaryNavLinks: NavLink[] = [
  { label: "Home", href: "/" },
  { label: "Daily Challenge", href: "/daily-challenge" },
  { label: "Courses", href: "/courses", comingSoon: true },
  { label: "Practice Lab", href: "/practice-lab", comingSoon: true },
  { label: "Progress", href: "/progress", comingSoon: true },
];
