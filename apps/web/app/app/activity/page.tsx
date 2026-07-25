"use client";

import { PageContainer, PageHeader } from "@/components/app/common";
import { ActivityFeed } from "@/components/app/activity-feed";
import { useTranslations } from "next-intl";
import { Activity } from "iconsax-reactjs";

export default function ActivityPage() {
  const t = useTranslations("activity");
  return (
    <PageContainer className="max-w-[760px]">
      <PageHeader title={t("title")} subtitle={t("subtitle")} icon={Activity} />
      <ActivityFeed limit={200} />
    </PageContainer>
  );
}
