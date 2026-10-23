import type { Metadata } from "next";
import { InfoPage } from "@/components/layout/InfoPage";
import { POLICIES_UPDATED, SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy | ZEK" };

export default function PrivacyPage() {
  return (
    <InfoPage
      title="Privacy"
      updated={POLICIES_UPDATED}
      intro={<p>What we collect when you use ZEK, why, and what you can do about it, in plain language.</p>}
      sections={[
        {
          title: "What we collect",
          body: (
            <ul>
              <li><strong>Account:</strong> your name, username, email, phone (optional) and a securely hashed password.</li>
              <li><strong>Orders:</strong> what you bought, delivery address, how you paid (for cards, only the last 4 digits) and the order&apos;s status.</li>
              <li><strong>Saved items:</strong> your bag, wishlist and saved addresses.</li>
              <li><strong>Chats with ZEK:</strong> the messages you send the assistant and its replies, so a conversation can continue.</li>
            </ul>
          ),
        },
        {
          title: "How we use it",
          body: (
            <ul>
              <li>To run your account, process and deliver orders, and handle cancellations and refunds.</li>
              <li>To let the assistant answer about your own bag and orders when you&apos;re signed in. It can only see your account, never anyone else&apos;s.</li>
              <li>To keep the store secure, for example by limiting repeated failed logins.</li>
            </ul>
          ),
        },
        {
          title: "Who else handles it",
          body: (
            <ul>
              <li>Messages you send the assistant are processed by our AI model provider to generate replies.</li>
              <li>If you chat with us on WhatsApp, those messages pass through WhatsApp.</li>
              <li>Product images are stored with our image hosting provider.</li>
              <li>We don&apos;t sell your data.</li>
            </ul>
          ),
        },
        {
          title: "Your choices",
          body: (
            <ul>
              <li>Update your profile and saved addresses on your account page.</li>
              <li>Delete your account from the account page. Past orders are kept for tax and warranty reasons.</li>
              <li>Questions or requests: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</li>
            </ul>
          ),
        },
      ]}
    />
  );
}
