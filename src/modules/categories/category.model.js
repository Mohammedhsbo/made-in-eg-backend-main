const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name_ar: {
      type: String,
      required: [true, 'Category Arabic name is required'],
      trim: true,
    },
    name_en: {
      type: String,
      required: [true, 'Category English name is required'],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, 'Category slug is required'],
      lowercase: true,
      trim: true,
    },
    fullSlug: {
      // E.g., women/clothing/tops
      type: String,
      unique: true,
      lowercase: true,
    },
    parent: {
      type: mongoose.Schema.ObjectId,
      ref: 'Category',
      default: null, // null means it's a top-level category (e.g., Women, Men)
    },
    level: {
      type: Number,
      required: true,
      default: 0, // 0=gender, 1=type, 2=subtype
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to generate fullSlug based on parent
categorySchema.pre('save', async function (next) {
  if (this.isModified('slug') || this.isModified('parent')) {
    if (this.parent) {
      const parentCategory = await this.constructor.findById(this.parent);
      if (parentCategory) {
        this.fullSlug = `${parentCategory.fullSlug}/${this.slug}`;
        this.level = parentCategory.level + 1;
      }
    } else {
      this.fullSlug = this.slug;
      this.level = 0;
    }
  }
  next();
});

const Category = mongoose.model('Category', categorySchema);
module.exports = Category;
