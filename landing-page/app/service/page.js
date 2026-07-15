
import Cta from "@/components/Cta";
import Faq from "@/components/Faq";
import GrowBusiness from "@/components/GrowBusiness";
import Services, { Service2 } from "@/components/Services";
import NextLayout from "@/layouts/NextLayout";

const page = () => {
  return (
    <NextLayout>

      <GrowBusiness paddingTop={9} />
      <Services />
      <Service2 paddingTop={9} title="Core Features" />
      <Cta />
      <Faq />
    </NextLayout>
  );
};
export default page;
