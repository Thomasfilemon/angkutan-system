const {
  DeliveryOrder,
  PurchaseOrder,
  DepositGroup,
  DepositGroupMember,
  Vehicle,
} = require("../models");
const { sequelize } = require("../config/database");
const { uploadFromBuffer } = require("../services/cloudinary.service");

exports.adminConfirmLoadAndComplete = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { actual_load_quantity, notes } = req.body || {};

    // Validate payload
    if (!actual_load_quantity || isNaN(parseFloat(actual_load_quantity))) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "actual_load_quantity is required and must be a number",
      });
    }

    // Normalize files list (support array, fields object, or single file)
    let suratJalanFiles = [];
    if (Array.isArray(req.files)) {
      // multer .array()
      suratJalanFiles = req.files;
    } else if (req.files && typeof req.files === "object") {
      // multer .fields() returns object with arrays per field
      Object.values(req.files).forEach((val) => {
        if (Array.isArray(val)) suratJalanFiles.push(...val);
      });
    } else if (req.file) {
      // multer .single()
      suratJalanFiles = [req.file];
    }

    if (!suratJalanFiles.length) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "At least one surat jalan photo is required",
      });
    }

    const deliveryOrder = await DeliveryOrder.findByPk(id, {
      include: [
        {
          model: PurchaseOrder,
          as: "purchaseOrder",
          attributes: ["id", "deposit_group_id", "unit", "unit_price"],
          include: [
            {
              model: DepositGroup,
              as: "depositGroup",
              attributes: [
                "id",
                "group_name",
                "status",
                "remaining_quantity",
                "balance",
              ],
            },
          ],
        },
      ],
      transaction,
    });

    if (!deliveryOrder) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Delivery Order not found" });
    }

    // Upload each buffer to Cloudinary and collect the returned public links
    const cloudinaryLinks = [];
    for (const f of suratJalanFiles) {
      const buffer = f.buffer;
      const originalname = f.originalname || f.filename || `file-${Date.now()}`;
      try {
        const uploaded = await uploadFromBuffer(buffer);
        cloudinaryLinks.push(uploaded.secure_url);
      } catch (uploadErr) {
        console.error("Cloudinary upload error:", uploadErr);
        // Rollback and return error
        await transaction.rollback();
        return res.status(500).json({
          success: false,
          message: `Failed to upload file ${originalname} to Cloudinary: ${uploadErr.message}`,
        });
      }
    }

    // Merge with existing photos to avoid overwriting unintentionally
    let existingPhotos = [];
    try {
      const existing = deliveryOrder.surat_jalan_photo_url;
      if (existing) {
        if (Array.isArray(existing)) {
          existingPhotos = existing.map((p) => String(p).replace(/\\/g, "/"));
        } else {
          existingPhotos = [String(existing).replace(/\\/g, "/")];
        }
      }
    } catch (e) {
      existingPhotos = [];
    }

    const mergedPhotos = Array.from(
      new Set([...existingPhotos, ...cloudinaryLinks])
    );

    // Update DO with actual quantity and merged photos first
    await deliveryOrder.update(
      {
        actual_load_quantity: parseFloat(actual_load_quantity),
        surat_jalan_photo_url: mergedPhotos,
      },
      { transaction }
    );

    // Reuse the standard complete logic (without files) now that actual qty is set
    // Prepare deposit handling similar to completeDeliveryOrder above
    const po = deliveryOrder.purchaseOrder;
    const isDepositLinked = !!(po && po.deposit_group_id);

    const dgMember = await DepositGroupMember.findOne({
      where: { delivery_order_id: id },
      include: [{ model: DepositGroup, as: "depositGroup" }],
      transaction,
    });

    const isInDepositGroup = !!dgMember;

    let paymentStatus;
    let paymentConfirmationStatus;
    let paymentConfirmedAt = null;

    if (isDepositLinked || isInDepositGroup) {
      paymentStatus = "lunas";
      paymentConfirmationStatus = "confirmed";
      paymentConfirmedAt = new Date();
    } else {
      paymentStatus = "awaiting_confirmation";
      paymentConfirmationStatus = "awaiting_confirmation";
    }

    const updateData = {
      status: "completed",
      completed_at: new Date(),
      payment_status: paymentStatus,
      payment_confirmation_status: paymentConfirmationStatus,
      payment_confirmation_at: paymentConfirmedAt,
      notes: notes || deliveryOrder.notes,
    };

    await deliveryOrder.update(updateData, { transaction });

    if (dgMember && dgMember.depositGroup) {
      const grp = dgMember.depositGroup;
      const qtyUsed = parseFloat(deliveryOrder.actual_load_quantity);
      const unitPrice = parseFloat(deliveryOrder.unit_price);
      if (isNaN(unitPrice)) {
        throw new Error(`Invalid unit_price for DO ${deliveryOrder.id}`);
      }
      const priceUsed = qtyUsed * unitPrice;

      const currentRemaining = parseFloat(grp.remaining_quantity) || 0;
      const currentBalance = parseFloat(grp.balance) || 0;

      grp.remaining_quantity = Math.max(0, currentRemaining - qtyUsed);
      grp.balance = Math.max(0, currentBalance - priceUsed);

      if (grp.remaining_quantity <= 0 && grp.balance <= 0) {
        grp.status = "fulfilled";
      } else if (grp.remaining_quantity < 0 || grp.balance < 0) {
        grp.status = "overdrawn";
      } else {
        grp.status = "active";
      }

      await grp.save({ transaction });
      await dgMember.update({ quantity: qtyUsed }, { transaction });
    }

    if (deliveryOrder.vehicle_id) {
      await Vehicle.update(
        { status: "available" },
        { where: { id: deliveryOrder.vehicle_id }, transaction }
      );
    }

    await transaction.commit();

    const updated = await DeliveryOrder.findByPk(id);
    return res.json({
      success: true,
      message: "DO confirmed and completed by admin",
      data: updated,
    });
  } catch (err) {
    await transaction.rollback();
    console.error("Error in adminConfirmLoadAndComplete:", err);
    return next(err);
  }
};
