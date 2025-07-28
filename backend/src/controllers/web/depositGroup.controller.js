const { DepositGroup, DepositGroupMember, DeliveryOrder, DeliveryOrderPayments, DeliveryOrderAdjustments, PurchaseOrder, sequelize } = require("../../models");
const { Op, fn, col } = require("sequelize");

// Helper function to get paid amount for a DO
async function getTotalPaidAmount(doId) {
  try {
    const result = await DeliveryOrderPayments.findOne({
      attributes: [[fn('COALESCE', fn('SUM', col('payment_amount')), 0), 'total_paid']],
      where: { delivery_order_id: doId },
      raw: true,
    });
    return parseFloat(result?.total_paid || 0);
  } catch (err) {
    console.error('Error calculating paid amount:', err);
    return 0;
  }
}

module.exports = {
  // Add this new method to the depositGroup controller
  // Update the finalizeDOAmount method
  // Add this new method
  // Example controller logic
  // async updateDOQuantity(req, res) {
  //   const { id } = req.params;
  //   const { quantity } = req.body;

  //   try {
  //     const doItem = await DeliveryOrder.findByPk(id);
  //     if (!doItem) {
  //       return res.status(404).json({ error: "DO not found" });
  //     }
  //     // Recalculate total_amount using unit_price from DB
  //     const unitPrice = doItem.unit_price;
  //     const total_amount = quantity * unitPrice;
  //     const final_amount = quantity * unitPrice; // Assuming final amount is same as total for simplicity
  //     await doItem.update({ quantity, total_amount, final_amount });
  //     res.json({ success: true, doItem });
  //   } catch (error) {
  //     console.error("Error updating DO quantity:", error);
  //     res.status(500).json({ error: "Failed to update quantity" });
  //   }
  // },
  // async finalizeDOAmount(req, res) {
  //   const { do_id } = req.params; // ✅ Use the correct parameter name
  //   const { finalized_amount } = req.body;

  //   try {
  //     const deliveryOrder = await DeliveryOrder.findByPk(do_id); // Now uses the correct ID
  //     if (!deliveryOrder) {
  //       return res.status(404).json({ error: 'Delivery Order not found' });
  //     }

  //     await deliveryOrder.update({
  //       final_amount: finalized_amount,
  //       is_amount_finalized: true
  //     });

  //     res.json({ success: true, message: 'Amount finalized successfully', deliveryOrder });
  //   } catch (error) {
  //     console.error('Error finalizing DO amount:', error);
  //     res.status(500).json({ error: 'Failed to finalize amount' });
  //   }
  // },
  // Create new deposit group
  // src/controllers/web/depositGroup.controller.js
  // src/controllers/web/depositGroup.controller.js
  async createGroup(req, res) {
    try {
       const { group_name, target_quantity, deposited_amount, unit, delivery_order_ids = [], purchase_order_id } = req.body;
      
      // *** FIX STARTS HERE ***
      // The initial balance of the group should be the amount that was deposited.
      const balance = deposited_amount; 
      const remaining_quantity = target_quantity; // Initial remaining = target
      
      const group = await DepositGroup.create({
        group_name, 
        balance, // Use the deposited amount as the starting balance
        target_quantity, 
        deposited_amount, 
        remaining_quantity, 
        unit, 
        status: 'active'
      });

      let doIdsToAdd = delivery_order_ids;

      // If PO is selected, get its DOs
      if (purchase_order_id) {
        const po = await PurchaseOrder.findByPk(purchase_order_id, {
          include: [{
            model: DeliveryOrder,
            as: 'poDeliveryOrders'
          }]
        });
        if (po && po.poDeliveryOrders) {
          doIdsToAdd = po.poDeliveryOrders.map(doItem => doItem.id);
        }
      }

      // Add DOs to group if provided
      if (doIdsToAdd.length > 0) {
        const deliveryOrders = await DeliveryOrder.findAll({
          where: { id: doIdsToAdd }
        });

        const members = doIdsToAdd.map(do_id => {
          const doItem = deliveryOrders.find(d => d.id === do_id);
          return {
            group_id: group.id,
            delivery_order_id: do_id,
            quantity: doItem ? doItem.minimal_load_quantity : 0
          };
        });

        await DepositGroupMember.bulkCreate(members)
      }

      res.status(201).json(group);
    } catch (error) {
      console.error("Error creating deposit group:", error);
      res.status(500).json({ 
        error: "Failed to create deposit group", 
        details: error.message 
      });
    }
  },
  async finalizeDOAmount(req, res) {
    const { do_id } = req.params; // ✅ Use the correct parameter name
    const { finalized_amount } = req.body;

    try {
      const deliveryOrder = await DeliveryOrder.findByPk(do_id); // Now uses the correct ID
      if (!deliveryOrder) {
        return res.status(404).json({ error: 'Delivery Order not found' });
      }

      await deliveryOrder.update({
        final_amount: finalized_amount,
        is_amount_finalized: true
      });

      res.json({ success: true, message: 'Amount finalized successfully', deliveryOrder });
    } catch (error) {
      console.error('Error finalizing DO amount:', error);
      res.status(500).json({ error: 'Failed to finalize amount' });
    }
  },

  // Get all groups with calculated status
  async getAllGroups(req, res) {
    try {
      const groups = await DepositGroup.findAll({
        include: [{
          model: DepositGroupMember,
          as: 'members',
          attributes: [],
        }]
      });
      
      // Calculate status for each group
      const groupsWithStatus = await Promise.all(groups.map(async group => {
        // Get all DOs in this group
        const members = await DepositGroupMember.findAll({
          where: { group_id: group.id },
          include: [
            {
              model: DeliveryOrder,
              as: 'deliveryOrder', // ✅ Must match the alias defined in the association
              attributes: ['id', 'do_number', 'customer_name', 'final_amount', 'total_amount', 'is_amount_finalized', 'payment_status']
            }
          ]
        });
        
        // Calculate total unpaid
        let totalUnpaid = 0;
        for (const member of members) {
          const paid = await getTotalPaidAmount(member.deliveryOrder.id);
          const unpaid = member.deliveryOrder.final_amount - paid;
          if (unpaid > 0) totalUnpaid += unpaid;
        }
        
        // Determine status
        let status = 'normal';
        if (totalUnpaid > group.balance) {
          status = 'butuh bayar';
        } else if (group.balance > totalUnpaid) {
          status = 'extra saldo';
        }
        
        return {
          ...group.get({ plain: true }),
          status
        };
      }));
      
      res.json(groupsWithStatus);
    } catch (error) {
      console.error("Error fetching deposit groups:", error);
      res.status(500).json({ error: "Failed to fetch deposit groups" });
    }
  },

  // Add to depositGroup.controller.js
  async payExtraCharge(req, res) {
    const { memberId } = req.params;
    const userId = req.user?.id;

    try {
      // Find the group member
      const member = await DepositGroupMember.findByPk(memberId, {
        include: [
          {
            model: DeliveryOrder,
            as: 'deliveryOrder',
            attributes: ['id', 'unit_price', 'minimal_load_quantity']
          }
        ]
      });

      if (!member) {
        return res.status(404).json({ error: "Group member not found" });
      }

      const doItem = member.deliveryOrder;
      
      // Calculate extra amount
      const extraQuantity = member.quantity - doItem.minimal_load_quantity;
      const extraAmount = extraQuantity * doItem.unit_price;
      
      if (extraAmount <= 0) {
        return res.status(400).json({ error: "No extra charge to pay" });
      }

      // Find ALL payments for this DO
      const payments = await DeliveryOrderPayments.findAll({
        where: { delivery_order_id: doItem.id }
      });

      let totalPaid = 0;
      let mainPayment = null;

      // Calculate total paid and find the main payment
      payments.forEach(payment => {
        totalPaid += parseFloat(payment.payment_amount);
        if (!payment.payment_type || payment.payment_type === 'check') {
          mainPayment = payment;
        }
      });

      // Calculate total expected payment
      const totalExpected = doItem.minimal_load_quantity * doItem.unit_price + extraAmount;
      
      // Update the main payment
      if (mainPayment) {
        // Calculate how much we need to add to reach the total expected
        const amountToAdd = totalExpected - totalPaid;
        
        await mainPayment.update({
          payment_amount: parseFloat(mainPayment.payment_amount) + amountToAdd,
          payment_date: new Date()
        });
      } else {
        // Create new payment if none exists
        mainPayment = await DeliveryOrderPayments.create({
          delivery_order_id: doItem.id,
          payment_amount: totalExpected,
          payment_date: new Date(),
          payment_type: 'check',
          created_by: userId
        });
      }

      // Update delivery order's actual load quantity
      await DeliveryOrder.update({
        actual_load_quantity: member.quantity,
        payment_status: 'lunas' // Mark as fully paid
      }, {
        where: { id: doItem.id }
      });

      res.json({ 
        success: true,
        paymentId: mainPayment.id,
        message: "Extra charge paid successfully"
      });
    } catch (error) {
      console.error("Error paying extra charge:", error);
      res.status(500).json({ error: "Failed to pay extra charge" });
    }
  },

  // Get group details with DO information
async getGroupDetails(req, res) {
    const { id } = req.params;
    try {
      const group = await DepositGroup.findByPk(id, {
        include: [
          {
            model: DepositGroupMember,
            as: "members",
            include: [{
              model: DeliveryOrder,
              as: "deliveryOrder",
              attributes: [
                "id", "do_number", "customer_name", "payment_status",
                "unit_price", "minimal_load_quantity", "actual_load_quantity"
              ],
            }],
            attributes: ["id", "delivery_order_id", "quantity"]
          },
          {
            model: PurchaseOrder,
            as: "purchaseOrders",
            attributes: ["id", "po_number", "customer_name", "status"],
          }
        ]
      });

      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }
      
      res.json(group);

    } catch (error) {
      console.error("Error fetching group details:", error);
      res.status(500).json({ error: "Failed to fetch group details" });
    }
  },

  // Update group details
  async updateGroup(req, res) {
    try {
      const { id } = req.params;
      const { group_name, balance } = req.body;
      
      const group = await DepositGroup.findByPk(id);
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }
      
      if (group_name) group.group_name = group_name;
      if (balance !== undefined) group.balance = parseFloat(balance);
      
      await group.save();
      res.json(group);
    } catch (error) {
      console.error("Error updating group:", error);
      res.status(500).json({ error: "Failed to update group" });
    }
  },

async updateMemberQuantity(req, res) {
  const { id } = req.params; // member ID
  const { quantity } = req.body;
  
  try {
    // Find the group member and associated delivery order
    const member = await DepositGroupMember.findByPk(id, {
      include: [{
        model: DeliveryOrder,
        as: "deliveryOrder",
        attributes: ['id', 'unit_price', 'minimal_load_quantity']
      }]
    });
    
    if (!member) {
      return res.status(404).json({ error: "Group member not found" });
    }

    const doItem = member.deliveryOrder;
    const unitPrice = parseFloat(doItem.unit_price);
    
    // ✅ NEW: Calculate the delta changes
    const oldQuantity = parseFloat(member.quantity);
    const newQuantity = parseFloat(quantity);
    const qtyDelta = newQuantity - oldQuantity;
    const amountDelta = qtyDelta * unitPrice;
    const newFinalAmount = newQuantity * unitPrice;

    // Update member quantity
    await member.update({ quantity: newQuantity });

    // ✅ NEW: Update DeliveryOrder with actual_load_quantity
    await doItem.update({
      actual_load_quantity: newQuantity,
      total_amount: newFinalAmount,
      final_amount: newFinalAmount
    });

    // ✅ NEW: Update group balance and remaining_quantity
    const group = await DepositGroup.findByPk(member.group_id);
    if (group) {
      // Reduce remaining_quantity and balance by the delta
      group.remaining_quantity = parseFloat(group.remaining_quantity) - qtyDelta;
      group.balance = parseFloat(group.balance) - amountDelta;
      
      // Update status if needed
      if (group.remaining_quantity <= 0) group.status = 'fulfilled';
      else if (group.remaining_quantity < 0) group.status = 'overdrawn';
      
      await group.save();
    }

    res.json({ 
      success: true, 
      member,
      message: "Quantity updated successfully and group totals recalculated"
    });
  } catch (error) {
    console.error("Error updating quantity:", error);
    res.status(500).json({ error: "Failed to update quantity" });
  }
},
  // Add DO to group
  async addDOToGroup(req, res) {
    try {
      const { group_id, delivery_order_id } = req.body;
      
      // Check if DO already belongs to a group
      const existingMembership = await DepositGroupMember.findOne({
        where: { delivery_order_id }
      });
      
      if (existingMembership) {
        return res.status(400).json({ 
          error: "DO already belongs to another group" 
        });
      }
      
      const membership = await DepositGroupMember.create({
        group_id,
        delivery_order_id
      });
      
      res.status(201).json(membership);
    } catch (error) {
      console.error("Error adding DO to group:", error);
      res.status(500).json({ error: "Failed to add DO to group" });
    }
  },

  // Remove DO from group
  async removeDOFromGroup(req, res) {
    try {
      const { id } = req.params; // membership ID
      
      const membership = await DepositGroupMember.findByPk(id);
      if (!membership) {
        return res.status(404).json({ error: "Membership not found" });
      }
      
      await membership.destroy();
      res.status(204).end();
    } catch (error) {
      console.error("Error removing DO from group:", error);
      res.status(500).json({ error: "Failed to remove DO from group" });
    }
  },

  // Delete entire group
  async deleteGroup(req, res) {
    try {
      const { id } = req.params;
      
      const group = await DepositGroup.findByPk(id);
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }
      
      // Delete all memberships first
      await DepositGroupMember.destroy({ where: { group_id: id } });
      
      await group.destroy();
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting group:", error);
      res.status(500).json({ error: "Failed to delete group" });
    }
  },

  // Adjust DO price
  async adjustDOPrice(req, res) {
    try {
      const { do_id } = req.params;
      const { new_amount, reason } = req.body;
      const userId = req.user?.id; // Assuming user ID from auth middleware

      const deliveryOrder = await DeliveryOrder.findByPk(do_id);
      if (!deliveryOrder) {
        return res.status(404).json({ error: "Delivery Order not found" });
      }

      const originalAmount = parseFloat(deliveryOrder.final_amount) || parseFloat(deliveryOrder.total_amount) || 0;
      const adjustmentAmount = parseFloat(new_amount) - originalAmount;
      const finalAmount = parseFloat(new_amount);

      if (isNaN(finalAmount) || finalAmount < 0) {
        return res.status(400).json({ error: "Invalid new amount - must be a non-negative number" });
      }

      // Create or update adjustment record
      const existingAdjustment = await DeliveryOrderAdjustments.findOne({
        where: { delivery_order_id: do_id },
      });

      let adjustment;
      if (existingAdjustment) {
        await existingAdjustment.update({
          adjustment_type: 'price_override',
          original_amount,
          adjustment_amount: adjustmentAmount,
          final_amount: finalAmount,
          reason: reason || 'Price finalization',
          approved_by: userId,
          updated_by: userId,
          updated_at: new Date(),
        });
        adjustment = existingAdjustment;
      } else {
        adjustment = await DeliveryOrderAdjustments.create({
          delivery_order_id: do_id,
          adjustment_type: 'price_override',
          original_amount,
          adjustment_amount: adjustmentAmount,
          final_amount: finalAmount,
          reason: reason || 'Price finalization',
          approved_by: userId,
          created_by: userId,
        });
      }

      // Update Delivery Order
      await deliveryOrder.update({
        final_amount: finalAmount,
        price_adjustment_reason: reason || null,
      });

      res.json({
        success: true,
        message: "DO price adjusted successfully - amounts recalculated",
        data: {
          adjustment,
          do_id: deliveryOrder.id,
          old_amount: originalAmount,
          new_amount: finalAmount,
          reason: reason || 'Price finalization',
        },
      });
    } catch (error) {
      console.error("Error adjusting DO price:", error);
      res.status(500).json({ error: "Failed to adjust DO price" });
    }
  },

async generateSelisihInvoice(req, res) {
    const transaction = await sequelize.transaction();
    try {
      const { id } = req.params;
      const group = await DepositGroup.findByPk(id, {
        include: [{
          model: DepositGroupMember,
          as: "members",
          include: [{
            model: DeliveryOrder,
            as: "deliveryOrder",
            where: { 
              status: 'completed',
              actual_load_quantity: { [Op.ne]: null } // Ensure actual quantity is recorded
            },
            required: true
          }]
        }],
        transaction
      });

      if (!group || !group.members || group.members.length === 0) {
        await transaction.rollback();
        return res.status(404).json({ error: "Group not found or has no completed DOs with actual quantity." });
      }

      if (group.selisih_status !== 'none') {
        await transaction.rollback();
        return res.status(400).json({ message: "Tagihan selisih sudah pernah dibuat untuk group ini." });
      }

      let totalExtraAmount = 0;
      let selisihReason = "Total selisih kuantitas dari DO berikut:\n";

      for (const member of group.members) {
        const doItem = member.deliveryOrder;
        const minimalQty = parseFloat(doItem.minimal_load_quantity);
        const actualQty = parseFloat(doItem.actual_load_quantity);
        const unitPrice = parseFloat(doItem.unit_price);

        if (actualQty > minimalQty) {
          const extraQty = actualQty - minimalQty;
          totalExtraAmount += extraQty * unitPrice;
          selisihReason += `- ${doItem.do_number}: Kelebihan ${extraQty.toFixed(2)} ${doItem.unit || 'ton'}\n`;
        }
      }

      if (totalExtraAmount <= 0) {
        await transaction.rollback();
        return res.status(400).json({ message: "Tidak ada selisih kuantitas untuk ditagihkan." });
      }

      // *** REFACTORED LOGIC: Update the group directly ***
      group.total_selisih_amount = totalExtraAmount;
      group.selisih_details = selisihReason;
      group.selisih_status = 'pending';
      group.status = 'pending_selisih'; // Also update the main status
      await group.save({ transaction });
      // *** END OF REFACTORED LOGIC ***

      await transaction.commit();

      res.json({
        success: true,
        message: `Tagihan selisih sebesar ${totalExtraAmount.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })} berhasil dibuat.`,
      });

    } catch (error) {
      await transaction.rollback();
      console.error("Error generating selisih invoice:", error);
      res.status(500).json({ error: "Failed to generate selisih invoice" });
    }
  },

async paySelisih(req, res) {
    const transaction = await sequelize.transaction();
    try {
      const { id } = req.params;
      const { payment_amount } = req.body;
      const group = await DepositGroup.findByPk(id, { transaction });

      if (!group) {
        await transaction.rollback();
        return res.status(404).json({ error: "Deposit Group not found" });
      }

      if (group.selisih_status !== 'pending') {
        await transaction.rollback();
        return res.status(400).json({ message: "No pending selisih to pay for this group." });
      }

      const amountToPay = parseFloat(payment_amount);
      if (isNaN(amountToPay) || amountToPay <= 0) {
        await transaction.rollback();
        return res.status(400).json({ message: "Invalid payment amount provided." });
      }

      const currentSelisih = parseFloat(group.total_selisih_amount);
      
      // You can't pay more than what is owed
      if (amountToPay > currentSelisih) {
        await transaction.rollback();
        return res.status(400).json({ message: `Payment amount cannot exceed the outstanding selisih of ${currentSelisih}.`});
      }

      const newSelisihAmount = currentSelisih - amountToPay;

      group.total_selisih_amount = newSelisihAmount;
      // Add the payment to the group's main balance
      group.balance = parseFloat(group.balance) + amountToPay;

      // If the selisih is fully paid, update the status
      if (newSelisihAmount <= 0) {
        group.selisih_status = 'paid';
        // Return the group to 'active' or 'fulfilled' status
        group.status = group.remaining_quantity <= 0 ? 'fulfilled' : 'active';
      }

      await group.save({ transaction });
      await transaction.commit();

      res.json({
        success: true,
        message: `Payment of ${amountToPay.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })} for selisih has been recorded.`,
        data: group
      });

    } catch (error) {
      await transaction.rollback();
      console.error("Error paying selisih:", error);
      res.status(500).json({ error: "Failed to process selisih payment" });
    }
  },

async linkPOToGroup(req, res) {
  const transaction = await sequelize.transaction();
  try {
    const { po_id, group_id } = req.body;
    
    // Link PO to deposit group
    await PurchaseOrder.update(
      { deposit_group_id: group_id },
      { where: { id: po_id }, transaction }
    );

    // Find all DOs from this PO that aren't already in deposit groups
    const existingDOs = await DeliveryOrder.findAll({
      where: { purchase_order_id: po_id },
      include: [{
        model: DepositGroupMember,
        as: 'groupMemberships',
        required: false
      }],
      transaction
    });

    // Add DOs to deposit group if they're not already in one
    for (const doItem of existingDOs) {
      const isAlreadyInGroup = doItem.groupMemberships && doItem.groupMemberships.length > 0;
      
      if (!isAlreadyInGroup) {
        await DepositGroupMember.create({
          group_id: group_id,
          delivery_order_id: doItem.id,
          quantity: doItem.minimal_load_quantity
        }, { transaction });
    
        
        console.log(`✅ Retroactively added DO ${doItem.do_number} to deposit group ${group_id} and marked as paid`);
      }
    }

    await transaction.commit();
    
    res.json({
      success: true,
      message: 'PO linked to deposit group and existing DOs added successfully'
    });
    
  } catch (error) {
    await transaction.rollback();
    console.error('Error linking PO to group:', error);
    res.status(500).json({ error: 'Failed to link PO to deposit group' });
  }
}


};