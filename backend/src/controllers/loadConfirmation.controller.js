// src/controllers/loadConfirmation.controller.js
const { DeliveryOrder, DriverProfile, Vehicle } = require("../models");
const path = require("path");

/**
 * @desc    Confirm load - Driver confirms actual load and uploads surat jalan photo
 * @route   POST /api/delivery-orders/:id/confirm-load
 * @access  Private (Driver only)
 */
exports.confirmLoad = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { actual_load_quantity } = req.body;
    const driverId = req.user.id;

    console.log("Confirm load request:", {
      id,
      actual_load_quantity,
      driverId,
    });
    console.log("Uploaded file:", req.file);

    // Validasi input
    if (!actual_load_quantity) {
      return res.status(400).json({
        message: "Berat muatan aktual harus diisi.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "Foto surat jalan harus diupload.",
      });
    }

    // Cari delivery order
    const deliveryOrder = await DeliveryOrder.findOne({
      where: {
        id,
        driver_id: driverId,
      },
    });

    if (!deliveryOrder) {
      return res.status(404).json({
        message:
          "Delivery Order tidak ditemukan atau Anda tidak berhak mengaksesnya.",
      });
    }

    // Verifikasi status
    if (deliveryOrder.status !== "at_load_location") {
      return res.status(400).json({
        message: `Tidak dapat konfirmasi muatan. Status saat ini: ${deliveryOrder.status}`,
      });
    }

    // Validasi quantity
    const actualQuantity = parseFloat(actual_load_quantity);
    const minimalQuantity = parseFloat(deliveryOrder.minimal_load_quantity);

    if (actualQuantity < minimalQuantity) {
      return res.status(400).json({
        message: `Muatan aktual (${actualQuantity} ton) kurang dari minimal yang ditetapkan (${minimalQuantity} ton).`,
      });
    }

    // Process file upload
    const surat_jalan_photo_url = req.file.path.replace(/\\/g, "/");

    // Update delivery order
    await deliveryOrder.update({
      actual_load_quantity: actualQuantity,
      surat_jalan_photo_url,
      status: "otw_to_unload_location",
      departed_from_load_location_at: new Date(),
    });

    // Calculate progress info
    const loadProgress = {
      percentage: (actualQuantity / minimalQuantity) * 100,
      excess:
        actualQuantity > minimalQuantity ? actualQuantity - minimalQuantity : 0,
      shortage:
        actualQuantity < minimalQuantity ? minimalQuantity - actualQuantity : 0,
      meets_minimum: actualQuantity >= minimalQuantity,
    };

    res.status(200).json({
      message:
        "Konfirmasi muatan berhasil. Perjalanan ke lokasi bongkar dimulai.",
      delivery_order: {
        id: deliveryOrder.id,
        do_number: deliveryOrder.do_number,
        status: deliveryOrder.status,
        status_text: "Menuju Lokasi Bongkar",
        minimal_load_quantity: minimalQuantity,
        actual_load_quantity: actualQuantity,
        load_progress: loadProgress,
        departed_from_load_location_at:
          deliveryOrder.departed_from_load_location_at,
        surat_jalan_photo_url: surat_jalan_photo_url,
      },
    });
  } catch (error) {
    console.error("Error in confirmLoad:", error);
    next(error);
  }
};

/**
 * @desc    Get load confirmation status
 * @route   GET /api/delivery-orders/:id/load-status
 * @access  Private (Driver + Admin)
 */
exports.getLoadStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const deliveryOrder = await DeliveryOrder.findByPk(id);

    if (!deliveryOrder) {
      return res.status(404).json({
        message: "Delivery Order tidak ditemukan.",
      });
    }

    // Security check
    if (user.role === "driver" && deliveryOrder.driver_id !== user.id) {
      return res.status(403).json({
        message: "Anda tidak berhak mengakses data ini.",
      });
    }

    const response = {
      id: deliveryOrder.id,
      do_number: deliveryOrder.do_number,
      status: deliveryOrder.status,
      minimal_load_quantity: deliveryOrder.minimal_load_quantity,
      actual_load_quantity: deliveryOrder.actual_load_quantity,
      has_load_confirmation: !!(
        deliveryOrder.actual_load_quantity &&
        deliveryOrder.surat_jalan_photo_url
      ),
      surat_jalan_photo_url: deliveryOrder.surat_jalan_photo_url,
      departed_from_load_location_at:
        deliveryOrder.departed_from_load_location_at,
      can_confirm_load: deliveryOrder.status === "at_load_location",
    };

    if (
      deliveryOrder.actual_load_quantity &&
      deliveryOrder.minimal_load_quantity
    ) {
      const actual = parseFloat(deliveryOrder.actual_load_quantity);
      const minimal = parseFloat(deliveryOrder.minimal_load_quantity);
      response.load_progress = {
        percentage: (actual / minimal) * 100,
        excess: actual > minimal ? actual - minimal : 0,
        shortage: actual < minimal ? minimal - actual : 0,
        meets_minimum: actual >= minimal,
      };
    }

    res.json(response);
  } catch (error) {
    console.error("Error in getLoadStatus:", error);
    next(error);
  }
};
