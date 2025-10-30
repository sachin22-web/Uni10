import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const inquirySchema = z.object({
  name: z.string().min(1, "Full Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().regex(/^\d{10,}$/, "Phone must be numeric with at least 10 digits"),
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(10, "Message must be at least 10 characters"),
  contact_method: z.enum(["Email", "Phone", "WhatsApp"], {
    errorMap: () => ({ message: "Please select a contact method" }),
  }),
  agree_contact: z.boolean().optional().default(false),
  hp: z.string().max(0, "Spam detected"),
});

type InquiryFormData = z.infer<typeof inquirySchema>;

export const InquiryForm: React.FC = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<InquiryFormData>({
    resolver: zodResolver(inquirySchema),
    defaultValues: {
      contact_method: "Email",
      agree_contact: false,
      hp: "",
    },
  });

  const contactMethod = watch("contact_method");

  const onSubmit = async (data: InquiryFormData) => {
    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const submittedAt = new Date().toISOString();

      const payload = {
        name: data.name,
        email: data.email,
        phone: data.phone,
        subject: data.subject,
        message: data.message,
        contact_method: data.contact_method,
        source: "website-contact",
        submitted_at: submittedAt,
        hp: data.hp,
      };

      const response = await fetch("/api/inquiry/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccessMessage("Thanks — inquiry received. We will contact you within 24 hours.");
        reset();
      } else {
        setErrorMessage(result.message || "Submission failed — try again.");
      }
    } catch (error) {
      setErrorMessage("Submission failed — try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto rounded-[12px] border border-border bg-card shadow-sm p-6 md:p-8">
      <div className="mb-8">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
          Get In Touch
        </h2>
        <p className="text-muted-foreground">
          Have a question? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Honeypot field */}
        <input
          type="text"
          {...register("hp")}
          style={{ display: "none" }}
          aria-hidden="true"
          autoComplete="off"
        />

        {/* Success Message */}
        {successMessage && (
          <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200">
            {successMessage}
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200">
            {errorMessage}
          </div>
        )}

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Full Name
                <span className="text-red-500 ml-1">*</span>
              </label>
              <Input
                placeholder="Your full name"
                {...register("name")}
                className={errors.name ? "border-red-500" : ""}
              />
              {errors.name && (
                <span className="text-sm text-red-500 mt-1 block">
                  {errors.name.message}
                </span>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Email
                <span className="text-red-500 ml-1">*</span>
              </label>
              <Input
                type="email"
                placeholder="your.email@example.com"
                {...register("email")}
                className={errors.email ? "border-red-500" : ""}
              />
              {errors.email && (
                <span className="text-sm text-red-500 mt-1 block">
                  {errors.email.message}
                </span>
              )}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Phone
                <span className="text-red-500 ml-1">*</span>
              </label>
              <Input
                placeholder="1234567890"
                {...register("phone")}
                className={errors.phone ? "border-red-500" : ""}
              />
              {errors.phone && (
                <span className="text-sm text-red-500 mt-1 block">
                  {errors.phone.message}
                </span>
              )}
            </div>

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Subject
                <span className="text-red-500 ml-1">*</span>
              </label>
              <Input
                placeholder="What is this about?"
                {...register("subject")}
                className={errors.subject ? "border-red-500" : ""}
              />
              {errors.subject && (
                <span className="text-sm text-red-500 mt-1 block">
                  {errors.subject.message}
                </span>
              )}
            </div>

            {/* Preferred Contact Method */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Preferred Contact Method
                <span className="text-red-500 ml-1">*</span>
              </label>
              <Select value={contactMethod} onValueChange={(value) => setValue("contact_method", value as any)}>
                <SelectTrigger className={errors.contact_method ? "border-red-500" : ""}>
                  <SelectValue placeholder="Select contact method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Email">Email</SelectItem>
                  <SelectItem value="Phone">Phone</SelectItem>
                  <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
              {errors.contact_method && (
                <span className="text-sm text-red-500 mt-1 block">
                  {errors.contact_method.message}
                </span>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Message */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Message
                <span className="text-red-500 ml-1">*</span>
              </label>
              <Textarea
                placeholder="Tell us more about your inquiry..."
                {...register("message")}
                className={`min-h-[160px] ${errors.message ? "border-red-500" : ""}`}
              />
              {errors.message && (
                <span className="text-sm text-red-500 mt-1 block">
                  {errors.message.message}
                </span>
              )}
            </div>

            {/* GDPR Checkbox */}
            <div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30">
                <Checkbox
                  {...register("agree_contact")}
                  className="mt-1"
                />
                <label className="text-sm leading-relaxed cursor-pointer">
                  <span className="font-medium">I agree to be contacted</span>
                  <br />
                  <span className="text-muted-foreground">
                    I consent to receive communications about my inquiry in accordance with the privacy policy.
                  </span>
                </label>
              </div>
              {errors.agree_contact && (
                <span className="text-sm text-red-500 mt-2 block">
                  {errors.agree_contact.message}
                </span>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full md:mt-8"
              size="lg"
            >
              {isSubmitting ? "Sending..." : "Send Inquiry"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};
