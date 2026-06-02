import { TranslationKey } from "@/lib/i18n";

type Translator = (key: TranslationKey) => string;

const exactErrorKeys: Record<string, TranslationKey> = {
  "AI image generation failed.": "error.aiImageGenerationFailed",
  "OPENAI_API_KEY is not configured.": "error.openaiKeyMissing",
  "Could not save AI images because vendor details are missing.": "error.aiImageVendorMissing",
  "AI image preview is invalid.": "error.aiImagePreviewInvalid",
  "Could not prepare AI image for upload.": "error.aiImagePrepareFailed",
  "Please enter length, width and height for dimensions images.": "error.aiDimensionsRequired",
  "Length, width and height are required for dimensions images.": "error.aiDimensionsRequired",
  "AI image generation did not return an image.": "error.aiImageNoResult",
  "Could not save AI generated images.": "error.aiImagePrepareFailed",
  "Could not submit product. Please check your connection and try again.": "error.productSubmitNetwork",
  "Could not save product. Please check your connection and try again.": "error.productSaveNetwork",
  "Compare at price must be higher than price.": "error.compareAtPriceHigher",
  "Please complete Title before submitting.": "error.productTitleRequired",
  "Please complete Product Overview before submitting.": "error.productOverviewRequired",
  "Please complete Price before submitting.": "error.productPriceRequired",
  "Please complete Stock before submitting.": "error.productStockRequired",
  "Please add at least one variant.": "error.productVariantRequired",
  "Please complete price for all variants before submitting.": "error.productVariantPriceRequired",
  "Please complete stock for all variants before submitting.": "error.productVariantStockRequired",
  "Please add at least one product image.": "error.productImageRequired",
  "Please complete Colour, Material and Assembly in Details.": "error.productRequiredDetails",
  "Please complete or remove empty detail rows.": "error.productIncompleteDetailRows"
};

const partialErrorKeys: Array<[string, TranslationKey]> = [
  ["This image cannot be used for AI image generation", "error.aiImageInvalid"],
  ["Could not read source product image", "error.aiSourceReadFailed"],
  ["The selected source image is empty", "error.aiSourceEmpty"],
  ["The selected source image is too large", "error.aiSourceTooLarge"],
  ["Please re-upload a standard JPG, PNG or WebP image", "error.aiImageInvalid"],
  ["standard JPG, PNG or WebP", "error.aiImageInvalid"]
];

export function translateClientError(message: unknown, t: Translator) {
  const text = typeof message === "string" ? message.trim() : "";
  if (!text) return "";
  const exactKey = exactErrorKeys[text];
  if (exactKey) return t(exactKey);
  const partial = partialErrorKeys.find(([needle]) => text.includes(needle));
  return partial ? t(partial[1]) : text;
}
