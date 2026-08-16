import PhasePlanApp from "@/components/PhasePlanApp";

export default function Home() {
  const stripeLinks = {
    diy: process.env.STRIPE_LINK_DIY || "",
    m1: process.env.STRIPE_LINK_1MO || "",
    m3: process.env.STRIPE_LINK_3MO || "",
    m6: process.env.STRIPE_LINK_6MO || "",
  };
  return <PhasePlanApp stripeLinks={stripeLinks} />;
}
